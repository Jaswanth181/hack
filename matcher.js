import mongoose from 'mongoose';
import Task from './Task.js';
import User from './User.js';
import Assignment from './Assignment.js';

/**
 * Automatically assign field volunteers to a task based on matching skills.
 * @param {string | mongoose.Types.ObjectId} taskId - The ID of the Task to process
 */
export async function assignVolunteersToTask(taskId) {
    console.log(`\n🔍 Starting volunteer assignment for Task: ${taskId}`);

    try {
        // 1. Retrieve the task
        const task = await Task.findById(taskId);
        if (!task) {
            console.error(`❌ Task ${taskId} not found.`);
            return;
        }

        if (task.status !== 'PENDING') {
            console.log(`⚠️ Task ${taskId} is not in PENDING status. Current status: ${task.status}`);
            return;
        }

        const requiredSkills = task.requiredSkills || [];
        const headcount = task.targetHeadcount || 1;

        console.log(`📋 Task requires skills: [${requiredSkills.join(', ')}] (Target Headcount: ${headcount})`);

        if (requiredSkills.length === 0) {
            console.log(`⚠️ Task has no required skills specified. Proceeding without skill filters...`);
        }

        // 2. Find eligible volunteers (FIELD role) who have AT LEAST ONE matching skill
        // If no skills required, we just fetch any FIELD user.
        let matchQuery = { role: 'FIELD' };
        if (requiredSkills.length > 0) {
            matchQuery.skills = { $in: requiredSkills };
        }

        const eligibleVolunteers = await User.find(matchQuery);

        if (eligibleVolunteers.length === 0) {
            console.log(`❌ No eligible volunteers found for Task ${taskId}. Unassigned.`);
            return;
        }

        // 3. Rank volunteers by how many skills overlap with the required skills
        let rankedVolunteers = eligibleVolunteers.map(volunteer => {
            const overlap = volunteer.skills.filter(skill => requiredSkills.includes(skill)).length;
            return { volunteer, overlap };
        });

        // Sort descending by overlap, then maybe just randomly or by proximity in a real app
        // Here we just sort by skill overlap
        if (requiredSkills.length > 0) {
            rankedVolunteers.sort((a, b) => b.overlap - a.overlap);
        }

        // Select up to the target headcount
        const selectedVolunteers = rankedVolunteers.slice(0, headcount).map(r => r.volunteer);

        console.log(`✅ Selected ${selectedVolunteers.length} volunteer(s) for the task.`);
        selectedVolunteers.forEach(v => {
            const overlapSkills = v.skills.filter(s => requiredSkills.includes(s));
            console.log(`   - ${v.name} (Skills: [${v.skills.join(', ')}] -> Matched: [${overlapSkills.join(', ')}])`);
        });

        // 4. Create assignments
        const assignmentsToCreate = selectedVolunteers.map(volunteer => ({
            taskId: task._id,
            volunteerId: volunteer._id,
            status: 'PENDING'
        }));

        // Ignore duplicates if they somehow exist using ordered: false or by catching E11000, 
        // but we are safe here since they are fresh.
        await Assignment.insertMany(assignmentsToCreate);
        console.log(`💾 Created ${assignmentsToCreate.length} Assignment records.`);

        // 5. Update the Task
        task.assignedVolunteers = selectedVolunteers.map(v => v._id);
        task.status = 'ASSIGNED';
        await task.save();

        console.log(`🏁 Task ${task._id} updated with assigned volunteers and status set to ASSIGNED.\n`);

    } catch (err) {
        console.error(`💥 Error in assignVolunteersToTask:`, err);
    }
}
