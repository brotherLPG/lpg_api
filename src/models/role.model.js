const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema(
  {
    roleName: {
      type: String,
      required: [true, 'roleName is required'],
      unique: true,
      trim: true,
    },
    roleDescription: {
      type: String,
      trim: true,
      default: '',
    },
    permissionIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Permission',
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Role', roleSchema);
