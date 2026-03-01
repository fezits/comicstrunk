import Stripe from 'stripe';
import { Prisma } from '@prisma/client';
import { prisma } from '../../shared/lib/prisma';
import { stripe, verifyWebhookSignature } from '../../shared/lib/stripe';

// === Helpers ===

/**
 * Extract current billing period dates from a Stripe subscription.
 * In Stripe API v2026-02-25+, period dates are on SubscriptionItem, not Subscription.
 */
function getSubscriptionPeriod(sub: Stripe.Subscription): {
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
} {
  const firstItem = sub.items.data[0];
  return {
    currentPeriodStart: new Date(firstItem.current_period_start * 1000),
    currentPeriodEnd: new Date(firstItem.current_period_end * 1000),
  };
}

/**
 * Extract the Stripe subscription ID from an invoice.
 * In Stripe API v2026-02-25+, the subscription reference is in invoice.parent.subscription_details.
 */
function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const subDetails = invoice.parent?.subscription_details;
  if (!subDetails?.subscription) return null;

  // subscription can be a string ID or an expanded Subscription object
  if (typeof subDetails.subscription === 'string') {
    return subDetails.subscription;
  }
  return subDetails.subscription.id;
}

// === Stripe Webhook Processor ===

/**
 * Process a Stripe webhook event with idempotency protection.
 *
 * 1. Verify signature (or skip in dev mode)
 * 2. Insert into WebhookEvent table (idempotency guard)
 * 3. Route to appropriate handler
 * 4. Mark as processed
 */
export async function processStripeWebhook(
  rawBody: Buffer,
  signature: string,
): Promise<void> {
  // 1. Verify signature and parse event
  const event = verifyWebhookSignature(rawBody, signature);

  // 2. Idempotency guard: try to insert event
  try {
    await prisma.webhookEvent.create({
      data: {
        provider: 'stripe',
        eventId: event.id,
        eventType: event.type,
        payload: event.data as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (error: unknown) {
    // Unique constraint violation = duplicate event, skip silently
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      console.log(`[Stripe Webhook] Duplicate event ${event.id} skipped`);
      return;
    }
    throw error;
  }

  // 3. Route event to handler
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error(`[Stripe Webhook] Error handling ${event.type}:`, error);
    // Don't rethrow — mark as processed anyway to prevent re-processing
  }

  // 4. Mark as processed
  await prisma.webhookEvent.update({
    where: {
      provider_eventId: {
        provider: 'stripe',
        eventId: event.id,
      },
    },
    data: { processedAt: new Date() },
  });
}

// === Event Handlers ===

/**
 * Handle checkout.session.completed: create/update Subscription, upgrade user to SUBSCRIBER.
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.metadata?.comicstrunkUserId;
  if (!userId || session.mode !== 'subscription') {
    console.log('[Stripe Webhook] Checkout session skipped (no userId or not subscription mode)');
    return;
  }

  if (!stripe) {
    console.error('[Stripe Webhook] Cannot retrieve subscription — Stripe client not initialized');
    return;
  }

  // Get subscription ID from session
  const sessionSubId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;

  if (!sessionSubId) {
    console.error('[Stripe Webhook] No subscription ID in checkout session');
    return;
  }

  // Retrieve full subscription from Stripe for period dates
  const stripeSubscription = await stripe.subscriptions.retrieve(sessionSubId);
  const { currentPeriodStart, currentPeriodEnd } = getSubscriptionPeriod(stripeSubscription);

  await prisma.$transaction(async (tx) => {
    // Check for existing active/trialing subscription for this user
    const existing = await tx.subscription.findFirst({
      where: {
        userId,
        stripeSubscriptionId: stripeSubscription.id,
        status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] },
      },
    });

    const subscriptionData = {
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: stripeSubscription.id,
      planType: 'BASIC' as const,
      status:
        stripeSubscription.status === 'trialing'
          ? ('TRIALING' as const)
          : ('ACTIVE' as const),
      currentPeriodStart,
      currentPeriodEnd,
    };

    if (existing) {
      await tx.subscription.update({
        where: { id: existing.id },
        data: subscriptionData,
      });
    } else {
      await tx.subscription.create({
        data: {
          userId,
          ...subscriptionData,
        },
      });
    }

    // Update user role to SUBSCRIBER (unless ADMIN)
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (user && user.role !== 'ADMIN') {
      await tx.user.update({
        where: { id: userId },
        data: { role: 'SUBSCRIBER' },
      });
    }
  });

  console.log(`[Stripe Webhook] Checkout completed for user ${userId}`);
}

/**
 * Handle customer.subscription.updated: sync period dates, handle cancellation scheduling.
 */
async function handleSubscriptionUpdated(
  stripeSubscription: Stripe.Subscription,
): Promise<void> {
  const subscription = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: stripeSubscription.id },
  });

  if (!subscription) {
    console.warn(
      `[Stripe Webhook] Subscription not found for stripeSubscriptionId ${stripeSubscription.id} (out-of-order event)`,
    );
    return;
  }

  // Map Stripe status to local enum
  const statusMap: Record<string, 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELLED'> = {
    active: 'ACTIVE',
    trialing: 'TRIALING',
    past_due: 'PAST_DUE',
    canceled: 'CANCELLED',
  };

  const mappedStatus = statusMap[stripeSubscription.status] ?? subscription.status;

  // Handle cancel_at_period_end scheduling
  let cancelledAt = subscription.cancelledAt;
  if (stripeSubscription.cancel_at_period_end === true && !subscription.cancelledAt) {
    // User scheduled cancellation at end of period
    cancelledAt = new Date();
  } else if (stripeSubscription.cancel_at_period_end === false && subscription.cancelledAt) {
    // User reactivated — clear cancellation
    cancelledAt = null;
  }

  const { currentPeriodStart, currentPeriodEnd } = getSubscriptionPeriod(stripeSubscription);

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: mappedStatus,
      currentPeriodStart,
      currentPeriodEnd,
      cancelledAt,
    },
  });

  console.log(
    `[Stripe Webhook] Subscription ${stripeSubscription.id} updated — status: ${mappedStatus}`,
  );
}

/**
 * Handle customer.subscription.deleted: downgrade to FREE, revert user role.
 */
async function handleSubscriptionDeleted(
  stripeSubscription: Stripe.Subscription,
): Promise<void> {
  const subscription = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: stripeSubscription.id },
  });

  if (!subscription) {
    console.warn(
      `[Stripe Webhook] Subscription not found for deletion: ${stripeSubscription.id}`,
    );
    return;
  }

  await prisma.$transaction(async (tx) => {
    // Downgrade subscription
    await tx.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'CANCELLED',
        planType: 'FREE',
        cancelledAt: new Date(),
      },
    });

    // Revert user role (unless ADMIN)
    const user = await tx.user.findUnique({ where: { id: subscription.userId } });
    if (user && user.role !== 'ADMIN') {
      await tx.user.update({
        where: { id: subscription.userId },
        data: { role: 'USER' },
      });
    }
  });

  // Create notification for subscription expiration
  await prisma.notification.create({
    data: {
      userId: subscription.userId,
      type: 'SUBSCRIPTION_EXPIRED',
      title: 'Assinatura expirada',
      message:
        'Sua assinatura BASIC expirou. Seu plano foi revertido para FREE.',
    },
  });

  console.log(
    `[Stripe Webhook] Subscription deleted for user ${subscription.userId} — downgraded to FREE`,
  );
}

/**
 * Handle invoice.payment_failed: set PAST_DUE status and create notification.
 */
async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const stripeSubscriptionId = getSubscriptionIdFromInvoice(invoice);
  if (!stripeSubscriptionId) return;

  const subscription = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId },
  });

  if (!subscription) {
    console.warn(
      `[Stripe Webhook] Subscription not found for failed invoice: ${stripeSubscriptionId}`,
    );
    return;
  }

  // Update subscription status to PAST_DUE
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { status: 'PAST_DUE' },
  });

  // Create notification for payment failure
  await prisma.notification.create({
    data: {
      userId: subscription.userId,
      type: 'SUBSCRIPTION_PAYMENT_FAILED',
      title: 'Falha no pagamento da assinatura',
      message:
        'Houve uma falha no pagamento da sua assinatura BASIC. Por favor, atualize seu meio de pagamento para evitar a perda dos beneficios.',
    },
  });

  console.log(
    `[Stripe Webhook] Payment failed for subscription ${stripeSubscriptionId} — set to PAST_DUE`,
  );
}

/**
 * Handle invoice.paid: confirm renewal, update period dates.
 * Only processes if subscription is PAST_DUE or TRIALING (recovery or trial-to-paid).
 */
async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const stripeSubscriptionId = getSubscriptionIdFromInvoice(invoice);
  if (!stripeSubscriptionId) return;

  const subscription = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId },
  });

  if (!subscription) {
    console.warn(
      `[Stripe Webhook] Subscription not found for paid invoice: ${stripeSubscriptionId}`,
    );
    return;
  }

  // Only process if subscription was in a recovery or trial state
  if (subscription.status !== 'PAST_DUE' && subscription.status !== 'TRIALING') {
    return;
  }

  if (!stripe) {
    console.error('[Stripe Webhook] Cannot retrieve subscription — Stripe client not initialized');
    return;
  }

  // Retrieve fresh subscription data from Stripe for period dates
  const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const { currentPeriodStart, currentPeriodEnd } = getSubscriptionPeriod(stripeSubscription);

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: 'ACTIVE',
      currentPeriodStart,
      currentPeriodEnd,
    },
  });

  // If user role was reverted to USER, set back to SUBSCRIBER
  const user = await prisma.user.findUnique({ where: { id: subscription.userId } });
  if (user && user.role === 'USER') {
    await prisma.user.update({
      where: { id: subscription.userId },
      data: { role: 'SUBSCRIBER' },
    });
  }

  console.log(
    `[Stripe Webhook] Invoice paid — subscription ${stripeSubscriptionId} reactivated to ACTIVE`,
  );
}
