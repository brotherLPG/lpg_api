const mongoose = require('mongoose');
const { PAYMENT_TYPES, PAYMENT_METHODS } = require('../constants/masters');

const paymentSchema = new mongoose.Schema(
  {
    paymentNumber: {
      type: String,
      required: [true, 'paymentNumber is required'],
      unique: true,
      trim: true,
    },
    paymentType: {
      type: String,
      enum: PAYMENT_TYPES,
      required: [true, 'paymentType is required'],
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      default: null,
    },
    paymentDate: {
      type: Date,
      required: [true, 'paymentDate is required'],
    },
    paymentAmount: {
      type: Number,
      required: [true, 'paymentAmount is required'],
      min: [0.01, 'paymentAmount must be greater than 0'],
    },
    paymentMethod: {
      type: String,
      enum: PAYMENT_METHODS,
      default: 'cash',
    },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: [true, 'accountId is required'],
    },
    saleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sale',
      default: null,
    },
    referenceNumber: { type: String, trim: true, default: '' },
    remarks: { type: String, trim: true, default: '' },
    receivedOrPaidByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

paymentSchema.index({ customerId: 1, paymentDate: -1 });
paymentSchema.index({ supplierId: 1, paymentDate: -1 });
paymentSchema.index({ saleId: 1 });
paymentSchema.index({ accountId: 1, paymentDate: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
