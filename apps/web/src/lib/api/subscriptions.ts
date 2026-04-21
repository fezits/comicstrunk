import apiClient from './client';

// === Types ===

export interface PlanConfig {
  id: string;
  planType: 'FREE' | 'BASIC';
  name: string;
  price: number;
  billingInterval: 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL';
  collectionLimit: number;
  commissionRate: number;
  trialDays: number;
  isActive: boolean;
  stripePriceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionStatus {
  id: string | null;
  planType: 'FREE' | 'BASIC';
  status: 'ACTIVE' | 'CANCELLED' | 'PAST_DUE' | 'TRIALING';
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelledAt: string | null;
  stripeCustomerId: string | null;
  collectionLimit: number;
  commissionRate: number;
}

export interface CheckoutSession {
  url: string;
  sessionId: string;
}

export interface PortalSession {
  url: string;
}

// === API Calls ===

export async function getPlans(): Promise<PlanConfig[]> {
  const response = await apiClient.get('/subscriptions/plans');
  return response.data.data;
}

export async function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  const response = await apiClient.get('/subscriptions/status');
  return response.data.data;
}

export async function createCheckout(planConfigId: string): Promise<CheckoutSession> {
  const response = await apiClient.post('/subscriptions/checkout', { planConfigId });
  return response.data.data;
}

export async function createPortalSession(): Promise<PortalSession> {
  const response = await apiClient.post('/subscriptions/portal');
  return response.data.data;
}

export async function cancelSubscription(): Promise<SubscriptionStatus> {
  const response = await apiClient.post('/subscriptions/cancel');
  return response.data.data;
}
