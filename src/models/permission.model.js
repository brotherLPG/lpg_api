const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema(
  {
    permissionCode: {
      type: String,
      required: [true, 'permissionCode is required'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    permissionName: {
      type: String,
      required: [true, 'permissionName is required'],
      trim: true,
    },
    moduleName: {
      type: String,
      required: [true, 'moduleName is required'],
      trim: true,
    },
    actionName: {
      type: String,
      required: [true, 'actionName is required'],
      trim: true,
    },
  },
  { timestamps: true }
);

permissionSchema.index({ moduleName: 1, actionName: 1 });

module.exports = mongoose.model('Permission', permissionSchema);
