import mongoose from 'mongoose';

const { Schema, model } = mongoose;

/**
 * GeoJSON Point sub-schema (reusable pattern).
 * Stores [longitude, latitude] as required by MongoDB 2dsphere index.
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
 * User Schema
 *
 * Covers two actor types in the platform:
 *   - ADMIN  : NGO administrators who create/manage tasks and view dashboards.
 *   - FIELD  : Field volunteers who receive assignments and log hours.
 *   - TASK   : Task reporters who submit surveys from the field (offline-first).
 *
 * Access patterns optimised:
 *   - Geo-proximity volunteer search  → 2dsphere index on `location`
 *   - Login lookup                    → unique index on `email`
 */
const userSchema = new Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },

    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false, // Never returned in queries by default
    },

    role: {
      type: String,
      enum: {
        values: ['ADMIN', 'FIELD', 'TASK'],
        message: 'Role must be ADMIN, FIELD, or TASK',
      },
      required: [true, 'Role is required'],
    },

    // ── Skills & Capacity ─────────────────────────────────────────────────────
    skills: {
      type: [String],
      default: [],
    },

    maxHoursPerWeek: {
      type: Number,
      min: [0, 'Hours cannot be negative'],
      default: 0,
    },

    complianceStatus: {
      type: Boolean,
      default: false, // Must be explicitly verified by an ADMIN
    },

    // ── Location (GeoJSON Point) ──────────────────────────────────────────────
    location: {
      type: pointSchema,
      required: false,
    },

    // ── Gamification / Performance Metrics ───────────────────────────────────
    tasksCompleted: {
      type: Number,
      default: 0,
      min: 0,
    },

    averageRating: {
      type: Number,
      default: 0,
      min: [0, 'Rating cannot be below 0'],
      max: [5, 'Rating cannot exceed 5'],
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────

// Enables $geoNear, $geoWithin, and $near spatial queries for volunteer lookup
userSchema.index({ location: '2dsphere' });

export default model('User', userSchema);
