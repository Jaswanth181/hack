import mongoose from 'mongoose';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import Survey from './Survey.js';
import Task from './Task.js';

// Load environment variables from .env file
dotenv.config();

const SYSTEM_PROMPT = `
You are a Crisis Response AI. Analyze the report and return a JSON object:

- crisisType: The specific event (e.g., Flood, Fire, Earthquake, Chemical Spill).
- needCategory: Categorize this into one of: [MEDICAL, SHELTER, FOOD, WATER, LOGISTICS].
- severityScore: A number from 1 to 10 based on immediate danger.
- title: A very brief summary (e.g., "Building Fire on Main St").
- requiredSkills: List of skills needed (e.g., ["Search and Rescue", "First Aid"]).

Return ONLY valid JSON.
`;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function processSurveys() {
    try {
        if (!process.env.MONGO_URI || !process.env.GEMINI_API_KEY) {
            throw new Error("MONGO_URI and GEMINI_API_KEY must be set in the .env file");
        }

        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Fetch all surveys that have not been processed yet
        const unprocessedSurveys = await Survey.find({ isProcessed: false });
        console.log(`Found ${unprocessedSurveys.length} unprocessed surveys.`);

        for (const survey of unprocessedSurveys) {
            console.log(`\n⏳ Processing survey ID: ${survey._id}...`);
            
            try {
                // Determine raw text to analyze
                const reportContent = survey.rawText || '';
                if (!reportContent) {
                    console.log(`Survey ${survey._id} has no rawText, skipping extraction.`);
                    survey.isProcessed = true;
                    await survey.save();
                    continue;
                }

                // Call Gemini API to extract structured data
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: `${SYSTEM_PROMPT}\n\nReport to analyze:\n${reportContent}`,
                    config: {
                        responseMimeType: "application/json",
                    }
                });

                const rawJson = response.text;
                const extractedData = JSON.parse(rawJson);
                console.log(`🤖 AI Extracted Data:`, extractedData);

                // Create the Task document mapping AI data to the Mongoose schema
                const newTask = new Task({
                    title: extractedData.title || 'Untitled Needs Report',
                    rawDescription: reportContent,
                    needCategory: extractedData.needCategory || 'LOGISTICS',
                    requiredSkills: extractedData.requiredSkills || [],
                    severityScore: extractedData.severityScore || 5, // Fallback middle score
                    location: survey.location,
                    reporterId: survey.reporterId,
                    offlineId: survey.offlineId,
                    status: 'PENDING'
                });

                await newTask.save();
                console.log(`📝 Task created successfully for survey ID: ${survey._id}`);

                // Mark survey as successfully processed
                survey.isProcessed = true;
                await survey.save();
                console.log(`✅ Survey ID: ${survey._id} marked as processed.`);
                
            } catch (err) {
                console.error(`❌ Failed to process survey ID: ${survey._id}`, err);
                // In a production system, you might increment a retry count here
            }
        }
    } catch (err) {
        console.error('Critical Database/Initialization Error:', err);
    } finally {
        // Disconnect from database to allow script to exit
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Start processing
processSurveys();
