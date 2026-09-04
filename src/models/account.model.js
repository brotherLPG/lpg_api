const mongoose = require('mongoose');
const { ACCOUNT_TYPES, ACCOUNT_CATEGORY_VALUES } = require('../constants/masters');

const accountSchema = new mongoose.Schema(
  {
    accountCode: {
      type: String,
      required: [true, 'accountCode is required'],
      unique: true,
      trim: true,
    },
    accountName: {
      type: String,
      required: [true, 'accountName is required'],
      trim: true,
    },
    accountType: {
      type: String,
      enum: ACCOUNT_TYPES,
      required: [true, 'accountType is required'],
    },
    accountCategory: {
      type: String,
      enum: ACCOUNT_CATEGORY_VALUES,
      default: 'operating',
    },
    parentAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      default: null,
    },
    description: { type: String, trim: true, default: '' },
    bankName: { type: String, trim: true, default: '' },
    branchName: { type: String, trim: true, default: '' },
    accountNumber: { type: String, trim: true, default: '' },
    ibanOrSwift: { type: String, trim: true, uppercase: true, default: '' },
    openingBalanceAmount: { type: Number, default: 0 },
    currentBalanceAmount: { type: Number, default: 0 },
    openedAt: { type: Date, default: null },
    allowManualEntries: { type: Boolean, default: true },
    isPrimary: { type: Boolean, default: false },
    needsReview: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

accountSchema.index({ accountType: 1, isActive: 1 });
accountSchema.index({ accountCategory: 1, isActive: 1 });
accountSchema.index({ parentAccountId: 1 });
accountSchema.index({ isPrimary: 1 });
accountSchema.index({ needsReview: 1 });

module.exports = mongoose.model('Account', accountSchema);
