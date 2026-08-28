const mongoose = require('mongoose');

const expenseCategorySchema = new mongoose.Schema(
  {
    categoryCode: {
      type: String,
      required: [true, 'categoryCode is required'],
      unique: true,
      trim: true,
    },
    categoryName: {
      type: String,
      required: [true, 'categoryName is required'],
      trim: true,
    },
    description: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

expenseCategorySchema.index({ isActive: 1 });

module.exports = mongoose.model('ExpenseCategory', expenseCategorySchema);
