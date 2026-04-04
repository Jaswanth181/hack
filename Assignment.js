import mongoose from 'mongoose';

const { Schema, model } = mongoose;

/**
 * Assignment Schema  —  Volunteer ↔ Task Junction & Audit Trail
 *
 * This collection is the authoritative source of truth for which volunteer is
 * working on which task. It replaces a naive `assignedVolunteers` array inside
 * Task with a richer, auditable record that captures lifecycle events, hours,
 * and post-completion feedback.
 *
 * The compound unique index on { taskId, volunteerId } is the primary guard
 * against double-booking: attempting to insert a second Assignment for the same
 * (task, volunteer) pair will throw a duplicate-key error that the API layer
 * should handle gracefully (409 Conflict).
 *
 * Access patterns optimised:
 *   - All assignments for a task        → index on `taskId`
 *   - All assignments for a volunteer   → index on `volunteerId`
 *   - Double-booking prevention         → compound unique index { taskId, volunteerId }
 */
const assignmentSchema = new Schema(
  {
    // ── References ────────────────────────────────────────────────────────────
    taskId: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
      required: [true, 'Task ID is required'],
    },

    volunteerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Volunteer ID is required'],
    },

    // ── Lifecycle State ───────────────────────────────────────────────────────
    status: {
      type: String,
      enum: {
        values: ['PENDING', 'ACCEPTED', 'COMPLETED'],
        message: 'Status must be PENDING, ACCEPTED, or COMPLETED',
      },
      default: 'PENDING',
    },

    // ── Post-Assignment Metrics ───────────────────────────────────────────────

    /**
     * hoursLogged: Filled in by the volunteer (or admin) when marking the
     * assignment COMPLETED. Used to track weekly hour budgets against
     * User.maxHoursPerWeek and to update User.tasksCompleted.
     */
    hoursLogged: {
      type: Number,
      min: [0, 'Hours logged cannot be negative'],
      default: null,
    },

    /**
     * performanceRating: 1–5 star rating given by the NGO admin or task reporter
     * after the assignment is completed. Feeds into User.averageRating via a
     * post-save hook or aggregation pipeline.
     */
    performanceRating: {
      type: Number,
      min: [1, 'Performance rating minimum is 1'],
      max: [5, 'Performance rating maximum is 5'],
      default: null,
    },

    feedbackNotes: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────

/**
 * Compound unique index — the anti-double-booking constraint.
 * Ensures one volunteer can only be assigned to the same task once.
 * Insert a duplicate (taskId, volunteerId) pair → MongoDB throws E11000.
 */
assignmentSchema.index({ taskId: 1, volunteerId: 1 }, { unique: true });

export default model('Assignment', assignmentSchema);
