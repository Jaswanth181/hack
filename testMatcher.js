import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Task from './Task.js';
import { assignVolunteersToTask } from './matcher.js';

dotenv.config();

async function runTest() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Create a fake task with specific required skills
        const newTask = new Task({
            title: "Test Crisis: Building Fire",
            rawDescription: "Fire in the building, we need medics and rescue teams.",
            needCategory: "MEDICAL",
            requiredSkills: ["Medical", "Search and Rescue"],
            severityScore: 8,
            location: {
                type: "Point",
                coordinates: [-80.19179, 25.76168]
            },
            reporterId: new mongoose.Types.ObjectId(), // Fake reporter
            targetHeadcount: 2,
            status: "PENDING"
        });

        await newTask.save();
        console.log(`📝 Generated mock task: ${newTask._id} with targetHeadcount: 2`);
        
        // Trigger matcher
        await assignVolunteersToTask(newTask._id);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

runTest();
