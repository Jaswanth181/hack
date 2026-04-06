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

        // Clear existing data (optional but good for clean testing)
        await User.deleteMany({});
        await Survey.deleteMany({});
        console.log('🧹 Cleared existing Users and Surveys');

        // 1. Create a fake reporter (TASK role)
        const mockUser = new User({
            name: "Jane Fieldworker",
            email: `jane.field.${crypto.randomUUID()}@example.com`,
            passwordHash: "dummyhash",
            role: "TASK",
            location: {
                type: "Point",
                coordinates: [-80.19179, 25.76168] // Miami Coordinates
            }
        });
        
        await mockUser.save();
        console.log(`👤 Created mock reporter: ${mockUser._id}`);

        // 2. Create the Volunteer Dump (FIELD role)
        const volunteerSkills = [
            ["Search and Rescue", "First Aid"],
            ["Medical", "CPR"],
            ["Logistics", "Driving"],
            ["Driving", "Heavy Machinery"],
            ["First Aid", "Translation"],
            ["Food Distribution", "Logistics"],
            ["Search and Rescue", "Swimming"],
            ["Medical", "First Aid", "Triage"]
        ];

        const volunteers = volunteerSkills.map((skills, index) => ({
            name: `Volunteer ${index + 1}`,
            email: `volunteer${index + 1}.${crypto.randomUUID()}@example.com`,
            passwordHash: "dummyhash",
            role: "FIELD",
            skills: skills,
            location: {
                type: "Point",
                // Slightly randomize coordinates around Miami
                coordinates: [
                    -80.19179 + (Math.random() - 0.5) * 0.1, 
                    25.76168 + (Math.random() - 0.5) * 0.1
                ]
            },
            maxHoursPerWeek: 20
        }));

        const insertedVolunteers = await User.insertMany(volunteers);
        console.log(`👷 Inserted ${insertedVolunteers.length} mock volunteers with varied skills!`);

        // 3. Create a couple of mock surveys from the field
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
