const mongoose = require('mongoose');

const syncOperationSchema = new mongoose.Schema(
  {
    operationId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    entity: {
      type: String,
      required: true,
      trim: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    status: {
      type: String,
      enum: ['applied'],
      default: 'applied',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SyncOperation', syncOperationSchema);
