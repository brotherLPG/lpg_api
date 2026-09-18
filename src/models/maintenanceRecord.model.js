const mongoose = require('mongoose');
const { MAINTENANCE_TYPES, PAYMENT_METHODS } = require('../constants/masters');

const maintenanceRecordSchema = new mongoose.Schema(
  {
    maintenanceNumber: {
      type: String,
      required: [true, 'maintenanceNumber is required'],
      unique: true,
      trim: true,
    },
    assetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Asset',
      required: [true, 'assetId is required'],
    },
    maintenanceType: {
      type: String,
      enum: MAINTENANCE_TYPES,
      required: [true, 'maintenanceType is required'],
    },
    maintenanceDate: {
      type: Date,
      required: [true, 'maintenanceDate is required'],
    },
    problemDescription: { type: String, trim: true, default: '' },
    workPerformed: { type: String, trim: true, default: '' },
    maintenanceCostAmount: { type: Number, min: 0, default: 0 },
    paymentMethod: {
      type: String,
      enum: PAYMENT_METHODS,
      default: 'cash',
    },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      default: null,
    },
    nextMaintenanceDate: { type: Date, default: null },
    performedByEmployeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: [true, 'performedByEmployeeId is required'],
    },
    approvedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'approvedByUserId is required'],
    },
  },
  { timestamps: true }
);

maintenanceRecordSchema.index({ assetId: 1, maintenanceDate: -1 });
maintenanceRecordSchema.index({ performedByEmployeeId: 1, maintenanceDate: -1 });
maintenanceRecordSchema.index({ accountId: 1 });

module.exports = mongoose.model('MaintenanceRecord', maintenanceRecordSchema);
