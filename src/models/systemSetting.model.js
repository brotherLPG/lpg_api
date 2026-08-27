const mongoose = require('mongoose');

const systemSettingSchema = new mongoose.Schema(
  {
    settingKey: {
      type: String,
      required: [true, 'settingKey is required'],
      unique: true,
      trim: true,
    },
    settingValue: {
      type: String,
      required: [true, 'settingValue is required'],
      trim: true,
    },
    settingDescription: {
      type: String,
      default: '',
      trim: true,
    },
    updatedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SystemSetting', systemSettingSchema);
