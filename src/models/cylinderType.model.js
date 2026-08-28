const mongoose = require('mongoose');

const cylinderTypeSchema = new mongoose.Schema(
  {
    typeCode: {
      type: String,
      required: [true, 'typeCode is required'],
      unique: true,
      trim: true,
    },
    typeName: {
      type: String,
      required: [true, 'typeName is required'],
      trim: true,
    },
    capacityKg: {
      type: Number,
      required: [true, 'capacityKg is required'],
      min: [0.01, 'capacityKg must be greater than 0'],
    },
    tareWeightKg: { type: Number, min: 0, default: 0 },
    sellingPricePerCylinder: { type: Number, min: 0, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CylinderType', cylinderTypeSchema);
