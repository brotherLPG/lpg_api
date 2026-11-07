const mongoose = require('mongoose');

const RETENTION_SECONDS = 3 * 24 * 60 * 60;

const activityLogSchema = new mongoose.Schema(
  {
    level: {
      type: String,
      enum: ['info', 'warn', 'error'],
      default: 'info',
    },
    kind: {
      type: String,
      enum: ['request', 'app'],
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    method: {
      type: String,
      default: '',
      trim: true,
    },
    path: {
      type: String,
      default: '',
      trim: true,
    },
    statusCode: {
      type: Number,
      default: null,
    },
    durationMs: {
      type: Number,
      default: null,
    },
    ipAddress: {
      type: String,
      default: '',
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_SECONDS });
activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ kind: 1, createdAt: -1 });
activityLogSchema.index({ path: 1, createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema, 'logs');
module.exports.RETENTION_SECONDS = RETENTION_SECONDS;
