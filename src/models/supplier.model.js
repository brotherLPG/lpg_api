const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema(
  {
    supplierCode: {
      type: String,
      required: [true, 'supplierCode is required'],
      unique: true,
      trim: true,
    },
    supplierName: {
      type: String,
      required: [true, 'supplierName is required'],
      trim: true,
    },
    contactPersonName: { type: String, trim: true, default: '' },
    phoneNumber: { type: String, trim: true, default: '' },
    emailAddress: { type: String, trim: true, lowercase: true, default: '' },
    isActive: { type: Boolean, default: true },
    paymentTermDays: { type: Number, min: 0, default: 30 },
    creditLimitAmount: { type: Number, min: 0, default: 0 },
    openingBalanceAmount: { type: Number, default: 0 },
    businessAddress: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    stateProvince: { type: String, trim: true, default: '' },
    taxRegistrationNumber: { type: String, trim: true, default: '' },
    bankName: { type: String, trim: true, default: '' },
    bankAccountTitle: { type: String, trim: true, default: '' },
    bankAccountNumber: { type: String, trim: true, default: '' },
    iban: { type: String, trim: true, uppercase: true, default: '' },
  },
  { timestamps: true }
);

supplierSchema.index({ supplierName: 1 });
supplierSchema.index({ isActive: 1 });
supplierSchema.index({ city: 1 });

module.exports = mongoose.model('Supplier', supplierSchema);
