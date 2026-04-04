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
 * Survey Schema  —  Offline-First Ingestion Staging Collection
 *
 * Field workers operate in areas with intermittent connectivity. The mobile app
 * generates an `offlineId` locally (UUID v4) and queues survey submissions.
 * When connectivity is restored, the app POSTs all queued surveys. The unique
 * constraint on `offlineId` guarantees idempotent upserts — re-submitting the
 * same survey never creates a duplicate document.
 *
 * Pipeline:
 *   Mobile device → Survey (isProcessed: false)
 *                 → AI Worker picks up unprocessed surveys
 *                 → Gemini API extracts structured data
 *                 → Task document created
 *                 → Survey.isProcessed set to true
 *
 * Access patterns optimised:
 *   - AI worker poll for unprocessed surveys → index on `isProcessed`
 *   - Idempotent offline sync                → unique index on `offlineId`
 */
const surveySchema = new Schema(
  {
    // ── Reporter ──────────────────────────────────────────────────────────────
    reporterId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reporter ID is required'],
    },

    /**
     * offlineId: A UUID generated on the mobile device at the moment the survey
     * is captured. Required and unique — this is the idempotency key that
     * prevents duplicate Tasks when a field worker resubmits a queued survey.
     */
    offlineId: {
      type: String,
      required: [true, 'Offline ID is required (generated on device)'],
      unique: true,
      trim: true,
    },

    // ── Content ───────────────────────────────────────────────────────────────

    /**
     * rawText: Unstructured, free-form description entered by the field worker.
     * This is the input that Gemini AI will parse to extract structured fields
     * (needCategory, requiredSkills, severityScore) for the Task document.
     */
    rawText: {
      type: String,
      trim: true,
    },

    location: {
      type: pointSchema,
    },

    // ── Processing State ──────────────────────────────────────────────────────

    /**
     * isProcessed: false  → Survey is queued and awaiting AI extraction.
     *              true   → AI has successfully processed this survey and the
     *                       corresponding Task document has been created.
     *
     * The AI worker queries { isProcessed: false } in batches, so this field
     * has a dedicated index.
     */
    isProcessed: {
      type: Boolean,
      default: false,
      index: true, // Fast poll queries by the AI background worker
    },
  },
  {
    timestamps: true,
  }
);

export default model('Survey', surveySchema);
