import { NotificationType, Prisma } from '@prisma/client';
import { prisma } from '../../shared/lib/prisma';
import { NotFoundError, ForbiddenError } from '../../shared/utils/api-error';

// All NotificationType enum values for preference defaults
const ALL_NOTIFICATION_TYPES: NotificationType[] = [
  'WELCOME',
  'PAYMENT_CONFIRMED',
  'ORDER_SHIPPED',
  'ITEM_SOLD',
  'PASSWORD_RESET',
  'DISPUTE_OPENED',
  'DISPUTE_RESPONDED',
  'DISPUTE_RESOLVED',
  'SUBSCRIPTION_PAYMENT_FAILED',
  'SUBSCRIPTION_EXPIRED',
];

// === Check if notification type is enabled for user ===

export async function isNotificationEnabled(
  userId: string,
  type: NotificationType,
): Promise<boolean> {
  const preference = await prisma.notificationPreference.findUnique({
    where: { userId_type: { userId, type } },
  });

  // If no row exists, default is enabled
  if (!preference) return true;

  return preference.enabled;
}

// === Create Notification (fire-and-forget safe) ===

export async function createNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}): Promise<unknown> {
  try {
    const enabled = await isNotificationEnabled(params.userId, params.type);
    if (!enabled) return null;

    return await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        metadata: params.metadata
          ? (params.metadata as Prisma.InputJsonValue)
          : undefined,
      },
    });
  } catch (error) {
    console.error('[Notifications] Failed to create notification:', error);
    return null;
  }
}

// === Get User Notifications (paginated) ===

export async function getUserNotifications(
  userId: string,
  page: number,
  limit: number,
  unreadOnly?: boolean,
) {
  const where: Record<string, unknown> = { userId };
  if (unreadOnly) {
    where.isRead = false;
  }

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notification.count({ where }),
  ]);

  return { notifications, total, page, limit };
}

// === Get Unread Count ===

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, isRead: false },
  });
}

// === Get Recent Notifications (for dropdown) ===

export async function getRecentNotifications(userId: string, limit = 5) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

// === Mark as Read ===

export async function markAsRead(userId: string, notificationId: string) {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw new NotFoundError('Notification not found');
  }

  if (notification.userId !== userId) {
    throw new ForbiddenError('You do not have access to this notification');
  }

  return prisma.notification.update({
    where: { id: notificationId },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });
}

// === Mark All as Read ===

export async function markAllAsRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  return { count: result.count };
}

// === Get Preferences ===

export async function getPreferences(userId: string) {
  const existing = await prisma.notificationPreference.findMany({
    where: { userId },
  });

  // Build a map of existing preferences
  const prefMap = new Map(existing.map((p) => [p.type, p.enabled]));

  // Return a complete list of all types with defaults
  return ALL_NOTIFICATION_TYPES.map((type) => ({
    type,
    enabled: prefMap.has(type) ? prefMap.get(type)! : true,
  }));
}

// === Update Preferences ===

export async function updatePreferences(
  userId: string,
  preferences: Array<{ type: NotificationType; enabled: boolean }>,
) {
  // Upsert each preference
  for (const pref of preferences) {
    await prisma.notificationPreference.upsert({
      where: { userId_type: { userId, type: pref.type } },
      update: { enabled: pref.enabled },
      create: {
        userId,
        type: pref.type,
        enabled: pref.enabled,
      },
    });
  }

  // Return the full updated preferences list
  return getPreferences(userId);
}
