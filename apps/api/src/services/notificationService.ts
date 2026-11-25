import https from 'node:https';
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
    channelId: string;
    priority: 'high';
    title: string;
    body: string;
    badge: number;
    data: Record<string, unknown>;
  }>
): Promise<unknown> {
  if (messages.length === 0) return { status: 0, ok: false, error: 'no messages' };

  const payload = JSON.stringify(messages);
  return new Promise((resolve) => {
    const req = https.request(
      'https://exp.pushservice.com/api/v2/push/send',
      {
        method: 'POST',
        family: 4,
        timeout: 12000,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const rawText = Buffer.concat(chunks).toString('utf8');
          let json: unknown = null;
          try {
            json = JSON.parse(rawText);
          } catch {
            json = rawText;
          }
          const status = res.statusCode ?? 0;
          const ok = status >= 200 && status < 300;
          if (!ok) {
            console.error('Expo push HTTP error:', status, json);
          }
          resolve({ status, ok, body: json });
        });
      }
    );

    req.on('timeout', () => {
      req.destroy(new Error('Expo push request timed out'));
    });

    req.on('error', (err) => {
      console.error('Expo push network error:', err);
      resolve({
        status: 0,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    req.write(payload);
    req.end();
  });
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
      channelId: 'default',
      priority: 'high' as const,
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

export async function sendTestPushToUser(userId: string): Promise<{
  tokenCount: number;
  tokens: string[];
  expoResponse: unknown;
}> {
  const uid = new mongoose.Types.ObjectId(userId);
  const docs = await PushTokenModel.find({ userId: uid }).lean();
  const validTokens = docs
    .map((d) => d.token)
    .filter((t) => t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken['));

  if (validTokens.length === 0) {
    return { tokenCount: 0, tokens: [], expoResponse: null };
  }

  const expoResponse = await sendExpoPushMessages(
    validTokens.map((token) => ({
      to: token,
      sound: 'default' as const,
      channelId: 'default',
      priority: 'high' as const,
      title: 'Test Push Notification',
      body: 'Push notifications are working for Campus Maintenance Copilot!',
      badge: 1,
      data: { eventType: 'test' },
    }))
  );

  return {
    tokenCount: validTokens.length,
    tokens: validTokens.map((t) => `${t.slice(0, 24)}...`),
    expoResponse,
  };
}

export async function getActiveSupervisorIds(): Promise<string[]> {
  const supervisors = await UserModel.find({ role: 'supervisor', active: true })
    .select('_id')
    .lean();
  return supervisors.map((s) => s._id.toString());
}
