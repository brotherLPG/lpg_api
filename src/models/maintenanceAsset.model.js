const mongoose = require('mongoose');
const { ASSET_CATEGORIES, MAINTENANCE_ASSET_STATUSES } = require('../constants/masters');

const maintenanceAssetSchema = new mongoose.Schema(
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
    manufacturerName: { type: String, trim: true, default: '' },
    modelNumber: { type: String, trim: true, default: '' },
    serialNumber: { type: String, trim: true, default: null },
    locationName: { type: String, trim: true, default: '' },
    operationalStatus: {
      type: String,
      enum: MAINTENANCE_ASSET_STATUSES,
      default: 'operational',
    },
  },
  { timestamps: true }
);

maintenanceAssetSchema.index({ operationalStatus: 1, assetCategory: 1 });
maintenanceAssetSchema.index({ serialNumber: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('MaintenanceAsset', maintenanceAssetSchema);
