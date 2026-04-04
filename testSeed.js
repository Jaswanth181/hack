import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './User.js';
import Survey from './Survey.js';
import crypto from 'crypto';

dotenv.config();

async function seedData() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB for Seeding');

        // Create a fake reporter
        const mockUser = new User({
            name: "Jane Fieldworker",
            email: "jane.field@example.com",
            passwordHash: "dummyhash",
            role: "TASK",
            location: {
                type: "Point",
                coordinates: [-80.19179, 25.76168] // Miami Coordinates
            }
        });
        
        await mockUser.save();
        console.log(`👤 Created mock user: ${mockUser._id}`);

        // Create a couple of mock surveys from the field
        const surveys = [
            {
                reporterId: mockUser._id,
                offlineId: crypto.randomUUID(),
                rawText: "Massive flooding in downtown Miami, 30 people trapped in a building, need boats immediately!",
                location: {
                    type: "Point",
                    coordinates: [-80.19179, 25.76168]
                }
            },
            {
                reporterId: mockUser._id,
                offlineId: crypto.randomUUID(),
                rawText: "A small kitchen fire started at the community center. Everyone evacuated safely, but we need someone to drop off water bottles and some snacks for the 15 people waiting outside.",
                location: {
                    type: "Point",
                    coordinates: [-80.2, 25.8]
                }
            }
        ];

        await Survey.insertMany(surveys);
        console.log(`📋 Inserted ${surveys.length} unprocessed mock surveys!`);

    } catch (err) {
        console.error("❌ Seeding Error:", err);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

seedData();
