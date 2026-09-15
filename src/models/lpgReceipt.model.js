const mongoose = require('mongoose');
const { PAYMENT_STATUSES, PAYMENT_METHODS } = require('../constants/masters');

const lpgReceiptSchema = new mongoose.Schema(
  {
    receiptNumber: {
      type: String,
      required: [true, 'receiptNumber is required'],
      unique: true,
      trim: true,
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: [true, 'supplierId is required'],
    },
    truckRegistrationNumber: { type: String, trim: true, default: '' },
    receivedAt: {
      type: Date,
      required: [true, 'receivedAt is required'],
    },
    receivedQuantityKg: {
      type: Number,
      required: [true, 'receivedQuantityKg is required'],
      min: [0.01, 'receivedQuantityKg must be greater than 0'],
    },
    purchaseRatePerKg: { type: Number, min: 0, default: 0 },
    totalPurchaseAmount: { type: Number, min: 0, default: 0 },
    paidAmount: { type: Number, min: 0, default: 0 },
    outstandingAmount: { type: Number, default: 0 },
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: 'unpaid',
    },
    paymentMethod: {
      type: String,
      enum: PAYMENT_METHODS,
    },
    referenceNumber: { type: String, trim: true, default: '' },
    storageTankId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StorageTank',
      required: [true, 'storageTankId is required'],
    },
    supplierInvoiceNumber: { type: String, trim: true, default: '' },
    receivedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'receivedByUserId is required'],
    },
    receivedByEmployeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    remarks: { type: String, trim: true, default: '' },
    receiptStatus: {
      type: String,
      enum: ['pending', 'confirmed'],
      default: 'confirmed',
    },
  },
  { timestamps: true }
);

lpgReceiptSchema.index({ supplierId: 1, receivedAt: -1 });
lpgReceiptSchema.index({ storageTankId: 1, receivedAt: -1 });
lpgReceiptSchema.index({ receiptStatus: 1, receivedAt: -1 });
lpgReceiptSchema.index({ paymentStatus: 1, receiptStatus: 1 });

module.exports = mongoose.model('LPGReceipt', lpgReceiptSchema);
