const mongoose = require('mongoose');

const fillingBatchSchema = new mongoose.Schema(
  {
    batchNumber: {
      type: String,
      required: [true, 'batchNumber is required'],
      unique: true,
      trim: true,
    },
    storageTankId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StorageTank',
      required: [true, 'storageTankId is required'],
    },
    cylinderTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CylinderType',
      required: [true, 'cylinderTypeId is required'],
    },
    cylinderCount: {
      type: Number,
      required: [true, 'cylinderCount is required'],
      min: [1, 'cylinderCount must be at least 1'],
    },
    targetFillWeightKg: {
      type: Number,
      required: [true, 'targetFillWeightKg is required'],
      min: [0.01, 'targetFillWeightKg must be greater than 0'],
    },
    actualLpgUsedKg: {
      type: Number,
      required: [true, 'actualLpgUsedKg is required'],
      min: [0.01, 'actualLpgUsedKg must be greater than 0'],
    },
    fillingDate: {
      type: Date,
      required: [true, 'fillingDate is required'],
    },
    operatorEmployeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: [true, 'operatorEmployeeId is required'],
    },
    createdByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'createdByUserId is required'],
    },
    remarks: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

fillingBatchSchema.index({ fillingDate: -1 });
fillingBatchSchema.index({ storageTankId: 1, fillingDate: -1 });
fillingBatchSchema.index({ cylinderTypeId: 1, fillingDate: -1 });

module.exports = mongoose.model('FillingBatch', fillingBatchSchema);
