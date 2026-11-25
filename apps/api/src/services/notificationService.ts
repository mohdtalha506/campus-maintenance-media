import mongoose from 'mongoose';
import type { NotificationDTO, NotificationListResponseDTO, TicketEventType } from '@campus/shared';
import { NotificationModel, type NotificationDocument } from '../models/Notification.js';
import { PushTokenModel } from '../models/PushToken.js';
import { UserModel } from '../models/User.js';

function toNotificationDTO(doc: NotificationDocument): NotificationDTO {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    ticketId: doc.ticketId ? doc.ticketId.toString() : null,
    ticketNumber: doc.ticketNumber ?? null,
    title: doc.title,
    body: doc.body,
    eventType: doc.eventType,
    read: doc.read,
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function registerPushToken(
  userId: string,
  token: string,
  platform: 'android' | 'ios' | 'web'
): Promise<void> {
  await PushTokenModel.findOneAndUpdate(
    { token },
    { userId: new mongoose.Types.ObjectId(userId), token, platform },
    { upsert: true, new: true }
  );
}

export async function unregisterPushToken(userId: string, token: string): Promise<void> {
  await PushTokenModel.deleteOne({
    userId: new mongoose.Types.ObjectId(userId),
    token,
  });
}

export async function listNotificationsForUser(
  userId: string,
  limit = 30
): Promise<NotificationListResponseDTO> {
  const uid = new mongoose.Types.ObjectId(userId);
  const [docs, unreadCount] = await Promise.all([
    NotificationModel.find({ userId: uid }).sort({ createdAt: -1 }).limit(limit),
    NotificationModel.countDocuments({ userId: uid, read: false }),
  ]);

  return {
    items: docs.map(toNotificationDTO),
    unreadCount,
  };
}

export async function markNotificationRead(
  userId: string,
  notificationId: string
): Promise<{ unreadCount: number }> {
  const uid = new mongoose.Types.ObjectId(userId);
  if (mongoose.Types.ObjectId.isValid(notificationId)) {
    await NotificationModel.updateOne(
      { _id: new mongoose.Types.ObjectId(notificationId), userId: uid },
      { $set: { read: true } }
    );
  }
  const unreadCount = await NotificationModel.countDocuments({ userId: uid, read: false });
  return { unreadCount };
}

export async function markAllNotificationsRead(
  userId: string
): Promise<{ unreadCount: number }> {
  const uid = new mongoose.Types.ObjectId(userId);
  await NotificationModel.updateMany({ userId: uid, read: false }, { $set: { read: true } });
  return { unreadCount: 0 };
}

async function sendExpoPushMessages(
  messages: Array<{
    to: string;
    sound: 'default';
    title: string;
    body: string;
    badge: number;
    data: Record<string, unknown>;
  }>
): Promise<void> {
  if (messages.length === 0 || typeof fetch !== 'function') return;
  try {
    await fetch('https://exp.pushservice.com/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });
  } catch {
    // Push delivery failure must never break ticket workflow
  }
}

export async function notifyUsers(params: {
  userIds: string[];
  excludeUserId?: string;
  ticketId: string | null;
  ticketNumber: string | null;
  title: string;
  body: string;
  eventType: TicketEventType;
}): Promise<void> {
  const uniqueIds = Array.from(new Set(params.userIds)).filter(
    (id) => id && id !== params.excludeUserId && mongoose.Types.ObjectId.isValid(id)
  );
  if (uniqueIds.length === 0) return;

  const objectIds = uniqueIds.map((id) => new mongoose.Types.ObjectId(id));
  const ticketObjId =
    params.ticketId && mongoose.Types.ObjectId.isValid(params.ticketId)
      ? new mongoose.Types.ObjectId(params.ticketId)
      : null;

  await NotificationModel.insertMany(
    objectIds.map((uid) => ({
      userId: uid,
      ticketId: ticketObjId,
      ticketNumber: params.ticketNumber,
      title: params.title,
      body: params.body,
      eventType: params.eventType,
      read: false,
    }))
  );

  const tokens = await PushTokenModel.find({ userId: { $in: objectIds } }).lean();
  if (tokens.length === 0) return;

  const unreadByUser = new Map<string, number>();
  await Promise.all(
    objectIds.map(async (uid) => {
      const count = await NotificationModel.countDocuments({ userId: uid, read: false });
      unreadByUser.set(uid.toString(), count);
    })
  );

  const expoMessages = tokens
    .filter((t) => t.token.startsWith('ExponentPushToken[') || t.token.startsWith('ExpoPushToken['))
    .map((t) => ({
      to: t.token,
      sound: 'default' as const,
      title: params.title,
      body: params.body,
      badge: unreadByUser.get(t.userId.toString()) ?? 1,
      data: {
        ticketId: params.ticketId,
        ticketNumber: params.ticketNumber,
        eventType: params.eventType,
      },
    }));

  await sendExpoPushMessages(expoMessages);
}

export async function getActiveSupervisorIds(): Promise<string[]> {
  const supervisors = await UserModel.find({ role: 'supervisor', active: true })
    .select('_id')
    .lean();
  return supervisors.map((s) => s._id.toString());
}
