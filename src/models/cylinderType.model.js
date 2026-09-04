const mongoose = require('mongoose');
const {
  CYLINDER_CATEGORY_VALUES,
  CYLINDER_COLOR_VALUES,
  CYLINDER_VALVE_VALUES,
  CYLINDER_MATERIAL_VALUES,
} = require('../constants/masters');

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
    cylinderCategory: {
      type: String,
      enum: CYLINDER_CATEGORY_VALUES,
      default: 'domestic',
    },
    capacityKg: {
      type: Number,
      required: [true, 'capacityKg is required'],
      min: [0.01, 'capacityKg must be greater than 0'],
    },
    tareWeightKg: { type: Number, min: 0, default: 0 },
    colorCode: {
      type: String,
      enum: [...CYLINDER_COLOR_VALUES, ''],
      default: '',
    },
    isActive: { type: Boolean, default: true },
    sellingPricePerCylinder: { type: Number, min: 0, default: 0 },
    purchasePriceAmount: { type: Number, min: 0, default: 0 },
    refillPriceAmount: { type: Number, min: 0, default: 0 },
    securityDepositAmount: { type: Number, min: 0, default: 0 },
    description: { type: String, trim: true, default: '' },
    valveType: {
      type: String,
      enum: [...CYLINDER_VALVE_VALUES, ''],
      default: '',
    },
    material: {
      type: String,
      enum: [...CYLINDER_MATERIAL_VALUES, ''],
      default: '',
    },
    safetyCertificationNumber: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

cylinderTypeSchema.index({ cylinderCategory: 1, isActive: 1 });
cylinderTypeSchema.index({ typeName: 1 });

module.exports = mongoose.model('CylinderType', cylinderTypeSchema);
