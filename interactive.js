import mongoose from 'mongoose';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import Task from './Task.js';
import readline from 'readline';
import { assignVolunteersToTask } from './matcher.js';

// Load environment variables
dotenv.config();

const SYSTEM_PROMPT = `
You are a Crisis Response AI. Analyze the report and return a JSON object:

- isCrisisRelated: true if the text describes a crisis, disaster, emergency, or need for assistance. false if it is just a greeting, spam, or irrelevant.
- crisisType: The specific event (e.g., Flood, Fire, Earthquake, Chemical Spill). Use "None" if isCrisisRelated is false.
- needCategory: Categorize this into one of: [MEDICAL, SHELTER, FOOD, WATER, LOGISTICS]. Use "LOGISTICS" if isCrisisRelated is false.
- severityScore: A number from 1 to 10 based on immediate danger. Use 1 if isCrisisRelated is false.
- title: A very brief summary (e.g., "Building Fire on Main St").
- requiredSkills: List of skills needed (e.g., ["Search and Rescue", "First Aid"]). Empty list if isCrisisRelated is false.

Return ONLY valid JSON.
`;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Set up the terminal prompt interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query) => new Promise(resolve => rl.question(query, resolve));

async function startInteractiveConsole() {
    try {
        if (!process.env.MONGO_URI || !process.env.GEMINI_API_KEY) {
            throw new Error("MONGO_URI and GEMINI_API_KEY must be set in the .env file");
        }

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB.');
        console.log('--------------------------------------------------');
        console.log('🎙️ INTERACTIVE CLI MODE');
        console.log('Type your crisis report below and press Enter.');
        console.log('Type "exit" to quit.');
        console.log('--------------------------------------------------\n');

        let isRunning = true;

        while (isRunning) {
            const answer = await askQuestion('Report > ');

            if (answer.toLowerCase().trim() === 'exit' || answer.toLowerCase().trim() === 'quit') {
                isRunning = false;
                break;
            }

            if (!answer.trim()) continue;

            console.log('⏳ Processing with Gemini AI...');

            try {
                // Call Gemini using the raw input strings directly
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: `${SYSTEM_PROMPT}\n\nReport to analyze:\n${answer}`,
                    config: {
                        responseMimeType: "application/json",
                    }
                });

                const rawJson = response.text;
                const extractedData = JSON.parse(rawJson);

                console.log(`\n🤖 Extracted Structured Data:`);
                console.log(extractedData);
                console.log('\n💾 Saving directly to the Tasks database...');

                // Push directly to Tasks
                const newTask = new Task({
                    title: extractedData.title || 'Interactive Report',
                    rawDescription: answer,
                    needCategory: extractedData.needCategory || 'LOGISTICS',
                    requiredSkills: extractedData.requiredSkills || [],
                    severityScore: extractedData.severityScore || 5,
                    isCrisisRelated: extractedData.isCrisisRelated ?? true,
                    location: {
                        type: "Point",
                        coordinates: [-80.19179, 25.76168] // Placeholder coordinates for testing
                    },
                    reporterId: new mongoose.Types.ObjectId(), // Generate a placeholder user ID for interactive testing
                    status: 'PENDING'
                });

                await newTask.save();
                console.log(`✅ Success! Task ID saved: ${newTask._id}\n`);
                
                if (extractedData.isCrisisRelated === false) {
                    console.log(`⚠️ Note: Analysis determined the text is NOT crisis-related. Assigments skipped, but record was saved.`);
                } else {
                    // Trigger the matching algorithm
                    await assignVolunteersToTask(newTask._id);
                }
            } catch (err) {
                console.error('❌ Error extracting or saving:', err.message);
                console.log();
            }
        }
    } catch (err) {
        console.error('Critical Error:', err);
    } finally {
        rl.close();
        await mongoose.disconnect();
        console.log('🔌 Goodbye!');
    }
}

// Start the console
startInteractiveConsole();
