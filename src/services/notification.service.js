const { Notification } = require('../models');
const ApiError = require('../utils/ApiError');
const { parsePagination, paginated } = require('../utils/pagination');

async function createNotification(payload) {
  return Notification.create(payload);
}

async function listMyNotifications(userId, query) {
  const { page, limit, skip } = parsePagination(query);
  const filter = { recipientUserId: userId };
  if (query.isRead === 'true') filter.isRead = true;
  if (query.isRead === 'false') filter.isRead = false;

  const [items, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipientUserId: userId, isRead: false }),
  ]);

  return {
    ...paginated(items, total, page, limit),
    unreadCount,
  };
}

async function markRead(userId, id) {
  const notification = await Notification.findOne({ _id: id, recipientUserId: userId });
  if (!notification) {
    throw new ApiError(404, 'Notification not found');
  }
  notification.isRead = true;
  await notification.save();
  return notification;
}

async function markAllRead(userId) {
  const result = await Notification.updateMany(
    { recipientUserId: userId, isRead: false },
    { $set: { isRead: true } }
  );
  return { updatedCount: result.modifiedCount };
}

module.exports = {
  createNotification,
  listMyNotifications,
  markRead,
  markAllRead,
};
