import { prisma } from '../../shared/lib/prisma';
import { stripe, isStripeConfigured } from '../../shared/lib/stripe';
import { BadRequestError, NotFoundError } from '../../shared/utils/api-error';
import type {
  AdminActivateSubscriptionInput,
  AdminSubscriptionListInput,
  CreatePlanConfigInput,
  UpdatePlanConfigInput,
} from '@comicstrunk/contracts';

// === List Active Plans ===

export async function listActivePlans() {
  const plans = await prisma.planConfig.findMany({
    where: { isActive: true },
    orderBy: [{ planType: 'asc' }, { price: 'asc' }],
  });

  return plans.map((plan) => ({
    ...plan,
    price: Number(plan.price),
    commissionRate: Number(plan.commissionRate),
  }));
}

// === Get Subscription Status ===

export async function getSubscriptionStatus(userId: string) {
  // Find the most recent active or trialing subscription
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: ['ACTIVE', 'TRIALING'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!subscription || subscription.planType === 'FREE') {
    // Return synthetic FREE status
    const freePlan = await prisma.planConfig.findFirst({
      where: { planType: 'FREE', isActive: true },
    });

    return {
      id: subscription?.id ?? null,
      planType: 'FREE' as const,
      status: 'ACTIVE' as const,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelledAt: null,
      stripeCustomerId: null,
      collectionLimit: freePlan?.collectionLimit ?? 50,
      commissionRate: freePlan ? Number(freePlan.commissionRate) : 0.1,
    };
  }

  // Fetch plan config for the subscription's plan type
  const planConfig = await prisma.planConfig.findFirst({
    where: { planType: subscription.planType, isActive: true },
    orderBy: { price: 'asc' },
  });

  return {
    id: subscription.id,
    planType: subscription.planType,
    status: subscription.status,
    currentPeriodStart: subscription.currentPeriodStart?.toISOString() ?? null,
    currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
    cancelledAt: subscription.cancelledAt?.toISOString() ?? null,
    stripeCustomerId: subscription.stripeCustomerId ?? null,
    collectionLimit: planConfig?.collectionLimit ?? 200,
    commissionRate: planConfig ? Number(planConfig.commissionRate) : 0.08,
  };
}

// === Create Checkout Session ===

export async function createCheckoutSession(userId: string, planConfigId: string) {
  if (!isStripeConfigured() || !stripe) {
    throw new BadRequestError('Stripe is not configured');
  }

  // Look up the plan config
  const planConfig = await prisma.planConfig.findUnique({
    where: { id: planConfigId },
  });

  if (!planConfig) {
    throw new NotFoundError('Plan not found');
  }

  if (!planConfig.isActive) {
    throw new BadRequestError('Plan is not active');
  }

  if (!planConfig.stripePriceId) {
    throw new BadRequestError('Plan not configured for Stripe billing');
  }

  // Check if user already has an active/trialing non-FREE subscription
  const existingSubscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: ['ACTIVE', 'TRIALING'] },
      planType: { not: 'FREE' },
    },
  });

  if (existingSubscription) {
    throw new BadRequestError(
      'You already have an active subscription. Use the customer portal to manage it.',
    );
  }

  // Check for existing Stripe customer ID from any of user's subscription records
  const existingWithCustomer = await prisma.subscription.findFirst({
    where: {
      userId,
      stripeCustomerId: { not: null },
    },
    orderBy: { createdAt: 'desc' },
  });

  let stripeCustomerId = existingWithCustomer?.stripeCustomerId;

  // Create Stripe customer if none exists
  if (!stripeCustomerId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: { comicstrunkUserId: userId },
    });

    stripeCustomerId = customer.id;
  }

  const webUrl = process.env.WEB_URL || 'http://localhost:3000';

  // Create Stripe Checkout Session
  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    line_items: [{ price: planConfig.stripePriceId, quantity: 1 }],
    mode: 'subscription',
    success_url: `${webUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${webUrl}/subscription/cancel`,
    subscription_data: {
      trial_period_days: planConfig.trialDays || undefined,
      metadata: { comicstrunkUserId: userId },
    },
    metadata: { comicstrunkUserId: userId, planConfigId },
  });

  return { url: session.url, sessionId: session.id };
}

// === Create Portal Session ===

export async function createPortalSession(userId: string) {
  if (!isStripeConfigured() || !stripe) {
    throw new BadRequestError('Stripe is not configured');
  }

  // Find user's subscription with a Stripe customer ID
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      stripeCustomerId: { not: null },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!subscription?.stripeCustomerId) {
    throw new BadRequestError('No Stripe subscription found');
  }

  const webUrl = process.env.WEB_URL || 'http://localhost:3000';

  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${webUrl}/account/subscription`,
  });

  return { url: session.url };
}

// === Cancel Subscription ===

export async function cancelSubscription(userId: string) {
  // Find user's active/trialing subscription with Stripe subscription ID
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: ['ACTIVE', 'TRIALING'] },
      stripeSubscriptionId: { not: null },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!subscription || !subscription.stripeSubscriptionId) {
    throw new NotFoundError('No active subscription found');
  }

  if (isStripeConfigured() && stripe) {
    // Schedule cancellation at period end (user keeps benefits until then)
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
  }

  // Update local record
  const updated = await prisma.subscription.update({
    where: { id: subscription.id },
    data: { cancelledAt: new Date() },
  });

  return {
    id: updated.id,
    planType: updated.planType,
    status: updated.status,
    currentPeriodStart: updated.currentPeriodStart?.toISOString() ?? null,
    currentPeriodEnd: updated.currentPeriodEnd?.toISOString() ?? null,
    cancelledAt: updated.cancelledAt?.toISOString() ?? null,
    stripeCustomerId: updated.stripeCustomerId ?? null,
  };
}

// ============================================================================
// ADMIN FUNCTIONS
// ============================================================================

// === Admin: List All Subscriptions ===

export async function adminListSubscriptions(filters: AdminSubscriptionListInput) {
  const { page, limit, status, planType } = filters;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (planType) where.planType = planType;

  const [data, total] = await Promise.all([
    prisma.subscription.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.subscription.count({ where }),
  ]);

  const mapped = data.map((sub) => ({
    id: sub.id,
    userId: sub.userId,
    userName: sub.user.name,
    userEmail: sub.user.email,
    userRole: sub.user.role,
    planType: sub.planType,
    status: sub.status,
    stripeCustomerId: sub.stripeCustomerId,
    stripeSubscriptionId: sub.stripeSubscriptionId,
    currentPeriodStart: sub.currentPeriodStart?.toISOString() ?? null,
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
    cancelledAt: sub.cancelledAt?.toISOString() ?? null,
    createdAt: sub.createdAt.toISOString(),
    updatedAt: sub.updatedAt.toISOString(),
  }));

  return { data: mapped, total, page, limit };
}

// === Admin: Manually Activate Subscription ===

export async function adminActivateSubscription(input: AdminActivateSubscriptionInput) {
  const { userId, planType, durationDays } = input;

  // Verify the target user exists
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new NotFoundError('User not found');
  }

  const now = new Date();
  const periodEnd = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

  const subscription = await prisma.$transaction(async (tx) => {
    // Check if user has existing ACTIVE or TRIALING subscription
    const existing = await tx.subscription.findFirst({
      where: {
        userId,
        status: { in: ['ACTIVE', 'TRIALING'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    let sub;
    if (existing) {
      // Update existing subscription
      sub = await tx.subscription.update({
        where: { id: existing.id },
        data: {
          planType,
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      });
    } else {
      // Create new subscription
      sub = await tx.subscription.create({
        data: {
          userId,
          planType,
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
        },
      });
    }

    // Update user role based on plan type (unless ADMIN)
    if (user.role !== 'ADMIN') {
      const newRole = planType === 'BASIC' ? 'SUBSCRIBER' : 'USER';
      await tx.user.update({
        where: { id: userId },
        data: { role: newRole },
      });
    }

    return sub;
  });

  return {
    id: subscription.id,
    userId: subscription.userId,
    planType: subscription.planType,
    status: subscription.status,
    currentPeriodStart: subscription.currentPeriodStart?.toISOString() ?? null,
    currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
    cancelledAt: subscription.cancelledAt?.toISOString() ?? null,
    stripeCustomerId: subscription.stripeCustomerId ?? null,
    stripeSubscriptionId: subscription.stripeSubscriptionId ?? null,
    createdAt: subscription.createdAt.toISOString(),
    updatedAt: subscription.updatedAt.toISOString(),
  };
}

// === Admin: List All Plan Configs (including inactive) ===

export async function adminListAllPlans() {
  const plans = await prisma.planConfig.findMany({
    orderBy: [{ planType: 'asc' }, { billingInterval: 'asc' }],
  });

  return plans.map((plan) => ({
    ...plan,
    price: Number(plan.price),
    commissionRate: Number(plan.commissionRate),
  }));
}

// === Admin: Create Plan Config ===

export async function adminCreatePlan(data: CreatePlanConfigInput) {
  const plan = await prisma.planConfig.create({
    data: {
      planType: data.planType,
      name: data.name,
      price: data.price,
      billingInterval: data.billingInterval,
      collectionLimit: data.collectionLimit,
      commissionRate: data.commissionRate,
      trialDays: data.trialDays,
      isActive: data.isActive,
      stripePriceId: data.stripePriceId ?? null,
    },
  });

  return {
    ...plan,
    price: Number(plan.price),
    commissionRate: Number(plan.commissionRate),
  };
}

// === Admin: Update Plan Config ===

export async function adminUpdatePlan(id: string, data: UpdatePlanConfigInput) {
  // Verify plan exists
  const existing = await prisma.planConfig.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Plan config not found');
  }

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.price !== undefined) updateData.price = data.price;
  if (data.collectionLimit !== undefined) updateData.collectionLimit = data.collectionLimit;
  if (data.commissionRate !== undefined) updateData.commissionRate = data.commissionRate;
  if (data.trialDays !== undefined) updateData.trialDays = data.trialDays;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.stripePriceId !== undefined) updateData.stripePriceId = data.stripePriceId;

  const plan = await prisma.planConfig.update({
    where: { id },
    data: updateData,
  });

  return {
    ...plan,
    price: Number(plan.price),
    commissionRate: Number(plan.commissionRate),
  };
}
