import mongoose from 'mongoose';

const { Schema, model } = mongoose;

/**
 * GeoJSON Point sub-schema.
 * [longitude, latitude] — required by MongoDB 2dsphere index spec.
 */
const pointSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
  },
  { _id: false }
);

/**
 * Task Schema
 *
 * Represents a verified community need. Raw field data arrives via the Survey
 * collection and is processed by the Gemini AI API, which populates the
 * AI-extracted fields before a Task document is created.
 *
 * Access patterns optimised:
 *   - Dashboard sort (status + priority) → compound index { status, calculatedPriority }
 *   - Geo-proximity task dispatch        → 2dsphere index on `location`
 *   - Offline sync deduplication         → sparse unique index on `offlineId`
 */
const taskSchema = new Schema(
  {
    // ── Core Fields ───────────────────────────────────────────────────────────
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
    },

    rawDescription: {
      type: String,
      required: [true, 'Raw description is required'],
      trim: true,
    },

    // ── AI-Extracted Fields (populated by Gemini API) ─────────────────────────
    needCategory: {
      type: String,
      enum: {
        values: ['MEDICAL', 'SHELTER', 'FOOD', 'WATER', 'LOGISTICS'],
        message: 'needCategory must be one of: MEDICAL, SHELTER, FOOD, WATER, LOGISTICS',
      },
      required: [true, 'Need category is required'],
    },

    requiredSkills: {
      type: [String],
      default: [],
    },

    severityScore: {
      type: Number,
      min: [1, 'Severity score minimum is 1'],
      max: [10, 'Severity score maximum is 10'],
      required: [true, 'Severity score is required'],
    },

    // ── System / Computed Fields ──────────────────────────────────────────────

    /**
     * calculatedPriority is computed server-side (e.g. severityScore weighted
     * by proximity and headcount) and stored here for O(1) sort on the dashboard.
     * Avoids expensive runtime computation on every list query.
     */
    calculatedPriority: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: {
        values: ['PENDING', 'ASSIGNED', 'RESOLVED'],
        message: 'Status must be PENDING, ASSIGNED, or RESOLVED',
      },
      default: 'PENDING',
    },

    // ── Logistics ─────────────────────────────────────────────────────────────
    targetHeadcount: {
      type: Number,
      min: [1, 'At least one volunteer is required'],
      default: 1,
    },

    assignedVolunteers: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    resolvedAt: {
      type: Date,
      default: null,
    },

    // ── Location (GeoJSON Point) ──────────────────────────────────────────────
    location: {
      type: pointSchema,
      required: [true, 'Task location is required'],
    },

    // ── Traceability ──────────────────────────────────────────────────────────
    reporterId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reporter ID is required'],
    },

    /**
     * offlineId: Generated on the mobile device before the survey is submitted.
     * sparse: true means the unique constraint only applies to documents that
     * actually have this field, allowing Tasks created online (without an offlineId)
     * to coexist in the collection without index conflicts.
     */
    offlineId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────

// Primary dashboard query: filter by status, then sort by priority descending
taskSchema.index({ status: 1, calculatedPriority: -1 });

// Enables $geoNear and proximity-based task dispatch queries
taskSchema.index({ location: '2dsphere' });

export default model('Task', taskSchema);
