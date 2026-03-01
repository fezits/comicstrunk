import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { stripe, isStripeConfigured } from '../lib/stripe';

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

  // Daily at 5 AM: Subscription reconciliation (safety net for missed Stripe webhooks)
  // The primary mechanism for subscription state changes is the webhook handler in
  // stripe-webhook.service.ts. This cron job catches subscriptions where a cancellation
  // was scheduled (cancelledAt is set) but the Stripe webhook for deletion may have been
  // missed, leaving the subscription stuck in ACTIVE/TRIALING after currentPeriodEnd.
  cron.schedule('0 5 * * *', async () => {
    try {
      const now = new Date();

      // Find subscriptions that are still ACTIVE/TRIALING but have expired and were scheduled for cancellation
      const expiredSubscriptions = await prisma.subscription.findMany({
        where: {
          status: { in: ['ACTIVE', 'TRIALING'] },
          planType: { not: 'FREE' },
          currentPeriodEnd: { not: null, lt: now },
          cancelledAt: { not: null },
        },
        include: {
          user: { select: { id: true, role: true } },
        },
      });

      let downgraded = 0;

      for (const sub of expiredSubscriptions) {
        try {
          // If Stripe is configured, verify the subscription is actually cancelled/expired
          if (isStripeConfigured() && stripe && sub.stripeSubscriptionId) {
            const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
            // If Stripe says it's still active/trialing, skip (our local data may be stale)
            if (stripeSub.status === 'active' || stripeSub.status === 'trialing') {
              continue;
            }
          }

          // Downgrade: update subscription, revert user role, create notification
          await prisma.$transaction(async (tx) => {
            await tx.subscription.update({
              where: { id: sub.id },
              data: {
                status: 'CANCELLED',
                planType: 'FREE',
                cancelledAt: sub.cancelledAt ?? new Date(),
              },
            });

            // Revert user role to USER (unless ADMIN)
            if (sub.user.role !== 'ADMIN') {
              await tx.user.update({
                where: { id: sub.userId },
                data: { role: 'USER' },
              });
            }

            // Create notification
            await tx.notification.create({
              data: {
                userId: sub.userId,
                type: 'SUBSCRIPTION_EXPIRED',
                title: 'Assinatura expirada',
                message:
                  'Sua assinatura foi encerrada automaticamente. Seu plano foi revertido para FREE.',
              },
            });
          });

          downgraded++;
          console.log(
            `[CRON] Downgraded subscription ${sub.id} for user ${sub.userId} (expired ${sub.currentPeriodEnd?.toISOString()})`,
          );
        } catch (subErr) {
          console.error(
            `[CRON] Error processing subscription ${sub.id}:`,
            subErr,
          );
        }
      }

      console.log(
        `[CRON] Subscription reconciliation: checked ${expiredSubscriptions.length}, downgraded ${downgraded}`,
      );
    } catch (err) {
      console.error('[CRON] Error in subscription reconciliation:', err);
    }
  });

  console.log('[CRON] All scheduled jobs registered');
}
