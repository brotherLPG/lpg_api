const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipientUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'recipientUserId is required'],
    },
    notificationType: {
      type: String,
      required: [true, 'notificationType is required'],
      trim: true,
    },
    notificationTitle: {
      type: String,
      required: [true, 'notificationTitle is required'],
      trim: true,
    },
    notificationMessage: {
      type: String,
      required: [true, 'notificationMessage is required'],
      trim: true,
    },
    referenceType: {
      type: String,
      default: null,
      trim: true,
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ recipientUserId: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
