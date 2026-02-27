import cron from 'node-cron';
import { prisma } from '../lib/prisma';

/**
 * Register all scheduled cron jobs for cart/order lifecycle management.
 * Called once on server startup.
 */
export function registerCronJobs(): void {
  // Every 5 minutes: Remove expired cart items (reservation timeout)
  cron.schedule('*/5 * * * *', async () => {
    try {
      const result = await prisma.cartItem.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });
      if (result.count > 0) {
        console.log(`[CRON] Removed ${result.count} expired cart item(s)`);
      }
    } catch (err) {
      console.error('[CRON] Error removing expired cart items:', err);
    }
  });

  // Daily at 3 AM: Clean up abandoned cart items older than 7 days
  cron.schedule('0 3 * * *', async () => {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const result = await prisma.cartItem.deleteMany({
        where: {
          createdAt: { lt: sevenDaysAgo },
        },
      });
      if (result.count > 0) {
        console.log(`[CRON] Cleaned up ${result.count} abandoned cart item(s)`);
      }
    } catch (err) {
      console.error('[CRON] Error cleaning up abandoned carts:', err);
    }
  });

  // Daily at 4 AM: Cancel unshipped order items older than 7 days
  cron.schedule('0 4 * * *', async () => {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const result = await prisma.orderItem.updateMany({
        where: {
          status: 'PROCESSING',
          shippedAt: null,
          createdAt: { lt: sevenDaysAgo },
        },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
        },
      });
      if (result.count > 0) {
        console.log(`[CRON] Cancelled ${result.count} unshipped order item(s)`);
      }
    } catch (err) {
      console.error('[CRON] Error cancelling unshipped orders:', err);
    }
  });

  console.log('[CRON] All scheduled jobs registered');
}
