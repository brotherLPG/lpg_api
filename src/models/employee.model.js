const mongoose = require('mongoose');
const { EMPLOYMENT_STATUSES } = require('../constants/masters');

const employeeSchema = new mongoose.Schema(
  {
    employeeCode: {
      type: String,
      required: [true, 'employeeCode is required'],
      unique: true,
      trim: true,
    },
    fullName: {
      type: String,
      required: [true, 'fullName is required'],
      trim: true,
    },
    departmentName: { type: String, trim: true, default: '' },
    jobTitle: { type: String, trim: true, default: '' },
    phoneNumber: { type: String, trim: true, default: '' },
    emailAddress: { type: String, trim: true, lowercase: true, default: '' },
    joiningDate: { type: Date, default: null },
    monthlySalaryAmount: { type: Number, min: 0, default: 0 },
    employmentStatus: {
      type: String,
      enum: EMPLOYMENT_STATUSES,
      default: 'active',
    },
  },
  { timestamps: true }
);

employeeSchema.index({ employmentStatus: 1 });
employeeSchema.index({ fullName: 1 });

module.exports = mongoose.model('Employee', employeeSchema);
