import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient, NotificationType } from '@prisma/client';
import { request, loginAs, TEST_USER, TEST_ADMIN } from '../setup';

const prisma = new PrismaClient();

let userToken: string;
let adminToken: string;
let testUserId: string;
let adminUserId: string;

// Track created notification IDs for cleanup
const createdNotificationIds: string[] = [];

beforeAll(async () => {
  const userLogin = await loginAs(TEST_USER.email, TEST_USER.password);
  userToken = userLogin.accessToken;

  const adminLogin = await loginAs(TEST_ADMIN.email, TEST_ADMIN.password);
  adminToken = adminLogin.accessToken;

  const testUser = await prisma.user.findUnique({ where: { email: TEST_USER.email } });
  testUserId = testUser!.id;

  const adminUser = await prisma.user.findUnique({ where: { email: TEST_ADMIN.email } });
  adminUserId = adminUser!.id;

  // Clean any leftover notifications for test user
  await prisma.notification.deleteMany({ where: { userId: testUserId } });
  await prisma.notificationPreference.deleteMany({ where: { userId: testUserId } });

  // Create test notifications: 2 unread, 1 read
  const n1 = await prisma.notification.create({
    data: {
      userId: testUserId,
      type: 'WELCOME',
      title: 'Welcome!',
      message: 'Welcome to Comics Trunk',
      isRead: false,
    },
  });
  createdNotificationIds.push(n1.id);

  const n2 = await prisma.notification.create({
    data: {
      userId: testUserId,
      type: 'ITEM_SOLD',
      title: 'Item Sold',
      message: 'Your comic was sold!',
      isRead: false,
    },
  });
  createdNotificationIds.push(n2.id);

  const n3 = await prisma.notification.create({
    data: {
      userId: testUserId,
      type: 'ORDER_SHIPPED',
      title: 'Order Shipped',
      message: 'Your order has been shipped',
      isRead: true,
      readAt: new Date(),
    },
  });
  createdNotificationIds.push(n3.id);

  // Create one notification for admin (for ownership tests)
  const n4 = await prisma.notification.create({
    data: {
      userId: adminUserId,
      type: 'WELCOME',
      title: 'Admin Welcome',
      message: 'Admin notification',
      isRead: false,
    },
  });
  createdNotificationIds.push(n4.id);
});

afterAll(async () => {
  // Clean notifications and preferences
  await prisma.notification.deleteMany({
    where: { id: { in: createdNotificationIds } },
  });
  await prisma.notification.deleteMany({ where: { userId: testUserId } });
  await prisma.notificationPreference.deleteMany({ where: { userId: testUserId } });

  await prisma.$disconnect();
});

// ============================================================================
// Notifications
// ============================================================================

describe('Notifications', () => {
  describe('GET /api/v1/notifications/unread-count', () => {
    it('returns correct unread count', async () => {
      const res = await request
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.count).toBe(2);
    });

    it('returns 401 without auth', async () => {
      await request
        .get('/api/v1/notifications/unread-count')
        .expect(401);
    });
  });

  describe('GET /api/v1/notifications/recent', () => {
    it('returns recent notifications (max 5)', async () => {
      const res = await request
        .get('/api/v1/notifications/recent')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(3);
      // Should be ordered by createdAt desc
      expect(res.body.data[0]).toHaveProperty('type');
      expect(res.body.data[0]).toHaveProperty('title');
      expect(res.body.data[0]).toHaveProperty('message');
    });

    it('returns 401 without auth', async () => {
      await request
        .get('/api/v1/notifications/recent')
        .expect(401);
    });
  });

  describe('GET /api/v1/notifications', () => {
    it('returns paginated notifications', async () => {
      const res = await request
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(3);
      expect(res.body.pagination).toHaveProperty('total');
      expect(res.body.pagination.total).toBe(3);
    });

    it('filters by unreadOnly=true', async () => {
      const res = await request
        .get('/api/v1/notifications?unreadOnly=true')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);
      for (const n of res.body.data) {
        expect(n.isRead).toBe(false);
      }
    });

    it('returns 401 without auth', async () => {
      await request
        .get('/api/v1/notifications')
        .expect(401);
    });
  });

  describe('PATCH /api/v1/notifications/:id/read', () => {
    it('marks notification as read', async () => {
      const notifId = createdNotificationIds[0]; // WELCOME, unread
      const res = await request
        .patch(`/api/v1/notifications/${notifId}/read`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.isRead).toBe(true);
      expect(res.body.data.readAt).toBeTruthy();
    });

    it('returns 404 for non-existent notification', async () => {
      await request
        .patch('/api/v1/notifications/nonexistent-id/read')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });

    it('returns 403 for notification owned by another user', async () => {
      const adminNotifId = createdNotificationIds[3]; // admin's notification
      await request
        .patch(`/api/v1/notifications/${adminNotifId}/read`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('returns 401 without auth', async () => {
      await request
        .patch(`/api/v1/notifications/${createdNotificationIds[1]}/read`)
        .expect(401);
    });
  });

  describe('PATCH /api/v1/notifications/read-all', () => {
    it('marks all unread as read, returns count', async () => {
      const res = await request
        .patch('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.count).toBeGreaterThanOrEqual(0);

      // Verify all are now read
      const unreadRes = await request
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(unreadRes.body.data.count).toBe(0);
    });

    it('returns count 0 when none unread', async () => {
      const res = await request
        .patch('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.count).toBe(0);
    });
  });

  describe('GET /api/v1/notifications/preferences', () => {
    it('returns all 10 types with default enabled', async () => {
      const res = await request
        .get('/api/v1/notifications/preferences')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(10);

      // All should default to enabled
      for (const pref of res.body.data) {
        expect(pref).toHaveProperty('type');
        expect(pref).toHaveProperty('enabled');
        expect(pref.enabled).toBe(true);
      }
    });

    it('returns 401 without auth', async () => {
      await request
        .get('/api/v1/notifications/preferences')
        .expect(401);
    });
  });

  describe('PUT /api/v1/notifications/preferences', () => {
    it('updates preferences (disable a type)', async () => {
      const res = await request
        .put('/api/v1/notifications/preferences')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          preferences: [
            { type: 'ITEM_SOLD', enabled: false },
          ],
        })
        .expect(200);

      expect(res.body.success).toBe(true);

      const itemSold = res.body.data.find(
        (p: { type: string }) => p.type === 'ITEM_SOLD',
      );
      expect(itemSold.enabled).toBe(false);
    });

    it('disabled preference prevents notification creation', async () => {
      // Import createNotification to test preference gating
      const { createNotification } = await import(
        '../../modules/notifications/notifications.service'
      );

      const result = await createNotification({
        userId: testUserId,
        type: 'ITEM_SOLD' as NotificationType,
        title: 'Should be blocked',
        message: 'This should not be created',
      });

      // createNotification returns null when preference is disabled
      expect(result).toBeNull();
    });

    it('re-enabling preference allows notifications again', async () => {
      // Re-enable ITEM_SOLD
      await request
        .put('/api/v1/notifications/preferences')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          preferences: [
            { type: 'ITEM_SOLD', enabled: true },
          ],
        })
        .expect(200);

      // Now create notification should work
      const { createNotification } = await import(
        '../../modules/notifications/notifications.service'
      );

      const result = await createNotification({
        userId: testUserId,
        type: 'ITEM_SOLD' as NotificationType,
        title: 'Should work now',
        message: 'This should be created',
      });

      expect(result).not.toBeNull();

      // Track for cleanup
      if (result && typeof result === 'object' && 'id' in result) {
        createdNotificationIds.push((result as { id: string }).id);
      }
    });
  });
});
