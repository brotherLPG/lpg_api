const mongoose = require('mongoose');
const { ITEM_CATEGORIES, UNITS_OF_MEASURE } = require('../constants/masters');

const inventoryItemSchema = new mongoose.Schema(
  {
    itemCode: {
      type: String,
      required: [true, 'itemCode is required'],
      unique: true,
      trim: true,
    },
    itemName: {
      type: String,
      required: [true, 'itemName is required'],
      trim: true,
    },
    itemCategory: {
      type: String,
      enum: ITEM_CATEGORIES,
      required: [true, 'itemCategory is required'],
    },
    unitOfMeasure: {
      type: String,
      enum: UNITS_OF_MEASURE,
      required: [true, 'unitOfMeasure is required'],
    },
    cylinderTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CylinderType',
      default: null,
    },
    currentQuantity: { type: Number, default: 0 },
    minimumStockLevel: { type: Number, min: 0, default: 0 },
    maximumStockLevel: { type: Number, min: 0, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

inventoryItemSchema.index({ itemCategory: 1, isActive: 1 });
inventoryItemSchema.index({ cylinderTypeId: 1 });

module.exports = mongoose.model('InventoryItem', inventoryItemSchema);
