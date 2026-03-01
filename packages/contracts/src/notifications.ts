import { z } from 'zod';
import { paginationSchema } from './common';

// === Notification Type Values ===

export const NOTIFICATION_TYPES = [
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
] as const;

export type NotificationTypeValue = (typeof NOTIFICATION_TYPES)[number];

// === Query Schema ===

export const notificationsQuerySchema = paginationSchema.extend({
  unreadOnly: z.coerce.boolean().optional(),
});

export type NotificationsQuery = z.infer<typeof notificationsQuerySchema>;

// === Update Preferences Schema ===

export const updatePreferencesSchema = z.object({
  preferences: z.array(
    z.object({
      type: z.enum(NOTIFICATION_TYPES),
      enabled: z.boolean(),
    }),
  ),
});

export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
