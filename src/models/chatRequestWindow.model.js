const mongoose = require('mongoose');

const chatRequestItemSchema = new mongoose.Schema(
  {
    requestId: {
      type: String,
      required: true,
      trim: true,
    },
    reservationId: {
      type: String,
      required: true,
      trim: true,
    },
    questionFingerprint: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
      required: true,
    },
    answer: {
      type: String,
      default: null,
    },
    workflowId: {
      type: String,
      default: null,
    },
    pageLink: {
      type: {
        label: { type: String, default: null },
        route: { type: String, default: null },
        note: { type: String, default: null },
      },
      default: null,
    },
    steps: {
      type: [String],
      default: [],
    },
    effectivePermissions: {
      type: [String],
      default: [],
    },
    error: {
      type: String,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const chatRequestWindowSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    requests: {
      type: [chatRequestItemSchema],
      default: [],
    },
    lastWorkflowId: {
      type: String,
      default: null,
    },
    lastWorkflowAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'chat_request_windows',
  }
);

// TTL index to automatically clean up inactive window documents when expiresAt passes
chatRequestWindowSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
chatRequestWindowSchema.index({ 'requests.requestId': 1 });
chatRequestWindowSchema.index({ 'requests.questionFingerprint': 1 });
chatRequestWindowSchema.index({ 'requests.reservationId': 1 });

module.exports = mongoose.model('ChatRequestWindow', chatRequestWindowSchema);
