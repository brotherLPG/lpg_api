const mongoose = require('mongoose');
const { TANK_STATUSES } = require('../constants/masters');

const storageTankSchema = new mongoose.Schema(
  {
    tankCode: {
      type: String,
      required: [true, 'tankCode is required'],
      unique: true,
      trim: true,
    },
    tankName: {
      type: String,
      required: [true, 'tankName is required'],
      trim: true,
    },
    capacityKg: {
      type: Number,
      required: [true, 'capacityKg is required'],
      min: [0.01, 'capacityKg must be greater than 0'],
    },
    currentQuantityKg: { type: Number, min: 0, default: 0 },
    minimumSafeQuantityKg: { type: Number, min: 0, default: 0 },
    maximumSafeQuantityKg: { type: Number, min: 0, default: 0 },
    tankStatus: {
      type: String,
      enum: TANK_STATUSES,
      default: 'operational',
    },
    installationDate: { type: Date, default: null },
    locationDescription: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

storageTankSchema.index({ tankStatus: 1 });

module.exports = mongoose.model('StorageTank', storageTankSchema);
