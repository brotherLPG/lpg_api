const mongoose = require('mongoose');
const { PAYMENT_METHODS } = require('../constants/masters');

const expenseSchema = new mongoose.Schema(
  {
    expenseNumber: {
      type: String,
      required: [true, 'expenseNumber is required'],
      unique: true,
      trim: true,
    },
    expenseCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExpenseCategory',
      required: [true, 'expenseCategoryId is required'],
    },
    expenseDate: {
      type: Date,
      required: [true, 'expenseDate is required'],
    },
    expenseDescription: {
      type: String,
      required: [true, 'expenseDescription is required'],
      trim: true,
    },
    expenseAmount: {
      type: Number,
      required: [true, 'expenseAmount is required'],
      min: [0.01, 'expenseAmount must be greater than 0'],
    },
    paymentMethod: {
      type: String,
      enum: PAYMENT_METHODS,
      default: 'cash',
    },
    paidFromAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: [true, 'paidFromAccountId is required'],
    },
    approvedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    recordedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    remarks: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

expenseSchema.index({ expenseCategoryId: 1, expenseDate: -1 });
expenseSchema.index({ paidFromAccountId: 1, expenseDate: -1 });

module.exports = mongoose.model('Expense', expenseSchema);
