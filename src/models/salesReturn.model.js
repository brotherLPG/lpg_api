const mongoose = require('mongoose');

const returnLineSchema = new mongoose.Schema(
  {
    inventoryItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryItem',
      required: true,
    },
    quantity: { type: Number, required: true, min: 0.01 },
    unitPriceAmount: { type: Number, required: true, min: 0 },
    lineTotalAmount: { type: Number, required: true, min: 0 },
  },
  { _id: true }
);

const salesReturnSchema = new mongoose.Schema(
  {
    returnNumber: {
      type: String,
      required: [true, 'returnNumber is required'],
      unique: true,
      trim: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'customerId is required'],
    },
    originalSaleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sale',
      required: [true, 'originalSaleId is required'],
    },
    returnDate: {
      type: Date,
      required: [true, 'returnDate is required'],
    },
    returnItems: {
      type: [returnLineSchema],
      required: true,
      validate: [(items) => items.length > 0, 'At least one return item is required'],
    },
    totalReturnAmount: { type: Number, required: true, min: 0 },
    returnReason: { type: String, trim: true, default: '' },
    processedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

salesReturnSchema.index({ customerId: 1, returnDate: -1 });
salesReturnSchema.index({ originalSaleId: 1 });

module.exports = mongoose.model('SalesReturn', salesReturnSchema);
