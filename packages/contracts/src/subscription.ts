import { z } from 'zod';

// === Plan Type Enum Values ===

export const PlanType = {
  FREE: 'FREE',
  BASIC: 'BASIC',
} as const;

export type PlanType = (typeof PlanType)[keyof typeof PlanType];

// === Billing Interval Enum Values ===

export const BillingInterval = {
  MONTHLY: 'MONTHLY',
  QUARTERLY: 'QUARTERLY',
  SEMIANNUAL: 'SEMIANNUAL',
  ANNUAL: 'ANNUAL',
} as const;

export type BillingInterval = (typeof BillingInterval)[keyof typeof BillingInterval];

// === Subscription Status Enum Values ===

export const SubscriptionStatus = {
  ACTIVE: 'ACTIVE',
  CANCELLED: 'CANCELLED',
  PAST_DUE: 'PAST_DUE',
  TRIALING: 'TRIALING',
} as const;

export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

// === Schemas ===

export const createCheckoutSchema = z.object({
  planConfigId: z.string(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export const planConfigResponseSchema = z.object({
  id: z.string(),
  planType: z.enum(['FREE', 'BASIC']),
  name: z.string(),
  price: z.number(),
  billingInterval: z.enum(['MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL']),
  collectionLimit: z.number(),
  commissionRate: z.number(),
  trialDays: z.number(),
  isActive: z.boolean(),
  stripePriceId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const subscriptionStatusResponseSchema = z.object({
  id: z.string().nullable(),
  planType: z.enum(['FREE', 'BASIC']),
  status: z.enum(['ACTIVE', 'CANCELLED', 'PAST_DUE', 'TRIALING']),
  currentPeriodStart: z.string().nullable(),
  currentPeriodEnd: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  stripeCustomerId: z.string().nullable(),
  collectionLimit: z.number(),
  commissionRate: z.number(),
});

// === Admin Schemas ===

export const adminActivateSubscriptionSchema = z.object({
  userId: z.string(),
  planType: z.enum(['FREE', 'BASIC']),
  durationDays: z.number().int().min(1).max(365).optional().default(30),
});

export const createPlanConfigSchema = z.object({
  planType: z.enum(['FREE', 'BASIC']),
  name: z.string().min(1).max(100),
  price: z.number().min(0),
  billingInterval: z.enum(['MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL']),
  collectionLimit: z.number().int().min(1),
  commissionRate: z.number().min(0).max(1),
  trialDays: z.number().int().min(0).max(365).optional().default(0),
  isActive: z.boolean().optional().default(true),
  stripePriceId: z.string().optional(),
});

export const updatePlanConfigSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  price: z.number().min(0).optional(),
  collectionLimit: z.number().int().min(1).optional(),
  commissionRate: z.number().min(0).max(1).optional(),
  trialDays: z.number().int().min(0).max(365).optional(),
  isActive: z.boolean().optional(),
  stripePriceId: z.string().nullable().optional(),
});

export const adminSubscriptionListSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z.enum(['ACTIVE', 'CANCELLED', 'PAST_DUE', 'TRIALING']).optional(),
  planType: z.enum(['FREE', 'BASIC']).optional(),
});

// === Inferred Types ===

export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;
export type PlanConfigResponse = z.infer<typeof planConfigResponseSchema>;
export type SubscriptionStatusResponse = z.infer<typeof subscriptionStatusResponseSchema>;
export type AdminActivateSubscriptionInput = z.infer<typeof adminActivateSubscriptionSchema>;
export type CreatePlanConfigInput = z.infer<typeof createPlanConfigSchema>;
export type UpdatePlanConfigInput = z.infer<typeof updatePlanConfigSchema>;
export type AdminSubscriptionListInput = z.infer<typeof adminSubscriptionListSchema>;
