const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    customerCode: {
      type: String,
      required: [true, 'customerCode is required'],
      unique: true,
      trim: true,
    },
    customerName: {
      type: String,
      required: [true, 'customerName is required'],
      trim: true,
    },
    contactPersonName: { type: String, trim: true, default: '' },
    phoneNumber: { type: String, trim: true, default: '' },
    emailAddress: { type: String, trim: true, lowercase: true, default: '' },
    billingAddress: { type: String, trim: true, default: '' },
    taxRegistrationNumber: { type: String, trim: true, default: '' },
    creditLimitAmount: { type: Number, min: 0, default: 0 },
    paymentTermDays: { type: Number, min: 0, default: 0 },
    openingBalanceAmount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

customerSchema.index({ customerName: 1 });
customerSchema.index({ isActive: 1 });

module.exports = mongoose.model('Customer', customerSchema);
