const mongoose = require('mongoose');
const { ACCOUNT_TYPES } = require('../constants/masters');

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
    parentAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      default: null,
    },
    openingBalanceAmount: { type: Number, default: 0 },
    currentBalanceAmount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

accountSchema.index({ accountType: 1, isActive: 1 });
accountSchema.index({ parentAccountId: 1 });

module.exports = mongoose.model('Account', accountSchema);
