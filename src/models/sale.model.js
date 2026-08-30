const mongoose = require('mongoose');
const { SALE_STATUSES, PAYMENT_STATUSES } = require('../constants/masters');

const saleLineSchema = new mongoose.Schema(
  {
    inventoryItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryItem',
      required: true,
    },
    itemDescription: { type: String, trim: true, default: '' },
    quantity: { type: Number, required: true, min: 0.01 },
    unitPriceAmount: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, min: 0, default: 0 },
    taxAmount: { type: Number, min: 0, default: 0 },
    lineTotalAmount: { type: Number, required: true, min: 0 },
  },
  { _id: true }
);

const saleSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: [true, 'invoiceNumber is required'],
      unique: true,
      trim: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'customerId is required'],
    },
    invoiceDate: {
      type: Date,
      required: [true, 'invoiceDate is required'],
    },
    lineItems: {
      type: [saleLineSchema],
      required: true,
      validate: [(items) => items.length > 0, 'At least one line item is required'],
    },
    subtotalAmount: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, min: 0, default: 0 },
    taxAmount: { type: Number, min: 0, default: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, min: 0, default: 0 },
    returnedAmount: { type: Number, min: 0, default: 0 },
    outstandingAmount: { type: Number, default: 0 },
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: 'unpaid',
    },
    saleStatus: {
      type: String,
      enum: SALE_STATUSES,
      default: 'confirmed',
    },
    createdByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    remarks: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

saleSchema.index({ customerId: 1, invoiceDate: -1 });
saleSchema.index({ paymentStatus: 1, saleStatus: 1 });

module.exports = mongoose.model('Sale', saleSchema);
