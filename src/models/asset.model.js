const mongoose = require('mongoose');
const { ASSET_CATEGORIES, ASSET_STATUSES, DEPRECIATION_METHODS } = require('../constants/masters');

const assetSchema = new mongoose.Schema(
  {
    assetCode: {
      type: String,
      required: [true, 'assetCode is required'],
      unique: true,
      trim: true,
    },
    assetName: {
      type: String,
      required: [true, 'assetName is required'],
      trim: true,
    },
    assetCategory: {
      type: String,
      enum: ASSET_CATEGORIES,
      required: [true, 'assetCategory is required'],
    },
    purchaseDate: { type: Date, default: null },
    purchaseCostAmount: { type: Number, min: 0, default: 0 },
    locationName: { type: String, trim: true, default: '' },
    assignedEmployeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    depreciationMethod: {
      type: String,
      enum: DEPRECIATION_METHODS,
      default: 'none',
    },
    currentBookValueAmount: { type: Number, min: 0, default: 0 },
    assetStatus: {
      type: String,
      enum: ASSET_STATUSES,
      default: 'in-use',
    },
  },
  { timestamps: true }
);

assetSchema.index({ assetCategory: 1, assetStatus: 1 });
assetSchema.index({ assignedEmployeeId: 1 });

module.exports = mongoose.model('Asset', assetSchema);
