import { NotificationType } from '@prisma/client';
import { sendMail } from '../../shared/lib/mail-transport';
import { isNotificationEnabled } from './notifications.service';
import { welcomeEmailTemplate } from '../../shared/email-templates/welcome';
import { paymentConfirmedEmailTemplate } from '../../shared/email-templates/payment-confirmed';
import { orderShippedEmailTemplate } from '../../shared/email-templates/order-shipped';
import { itemSoldEmailTemplate } from '../../shared/email-templates/item-sold';
import { passwordResetEmailTemplate } from '../../shared/email-templates/password-reset';
import { disputeOpenedEmailTemplate } from '../../shared/email-templates/dispute-opened';
import { disputeResolvedEmailTemplate } from '../../shared/email-templates/dispute-resolved';

// === Internal helper: send a single email ===

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const result = await sendMail({ to, subject, html });
  if (result.ok) {
    console.log(
      `[EMAIL] Enviado via ${result.transport} "${subject}" -> ${to} (id=${result.id ?? 'unknown'})`,
    );
  } else if (result.transport === 'none') {
    console.warn(
      `[EMAIL] DESABILITADO — ${result.reason}. Email "${subject}" para ${to} NÃO foi enviado.`,
    );
  } else {
    console.error(
      `[EMAIL] Falha via ${result.transport} ao enviar "${subject}" -> ${to}: ${result.reason}`,
    );
  }
}

// === Helper: check preference then send ===

async function checkPreferenceAndSend(
  userId: string,
  type: NotificationType,
  email: string,
  subject: string,
  html: string,
): Promise<void> {
  try {
    const enabled = await isNotificationEnabled(userId, type);
    if (!enabled) {
      console.log(`[EMAIL] Notification ${type} disabled for user ${userId}, skipping: ${subject}`);
      return;
    }
    await sendEmail(email, subject, html);
  } catch (error) {
    console.error(`[EMAIL] Error in preference check or send for ${type}:`, error);
  }
}

// === Public email functions ===

/**
 * Send welcome email after signup.
 * Checks WELCOME notification preference.
 */
export async function sendWelcomeEmail(
  userId: string,
  email: string,
  userName: string,
): Promise<void> {
  const { subject, html } = welcomeEmailTemplate({ userName });
  await checkPreferenceAndSend(userId, 'WELCOME', email, subject, html);
}

/**
 * Send payment confirmed email.
 * Checks PAYMENT_CONFIRMED notification preference.
 */
export async function sendPaymentConfirmedEmail(
  userId: string,
  email: string,
  data: {
    userName: string;
    orderNumber: string;
    totalAmount: string;
    itemCount: number;
  },
): Promise<void> {
  const { subject, html } = paymentConfirmedEmailTemplate(data);
  await checkPreferenceAndSend(userId, 'PAYMENT_CONFIRMED', email, subject, html);
}

/**
 * Send order shipped email to buyer.
 * Checks ORDER_SHIPPED notification preference.
 */
export async function sendOrderShippedEmail(
  userId: string,
  email: string,
  data: {
    userName: string;
    orderNumber: string;
    trackingCode: string;
    carrier?: string;
    itemTitle: string;
  },
): Promise<void> {
  const { subject, html } = orderShippedEmailTemplate(data);
  await checkPreferenceAndSend(userId, 'ORDER_SHIPPED', email, subject, html);
}

/**
 * Send item sold email to seller.
 * Checks ITEM_SOLD notification preference.
 */
export async function sendItemSoldEmail(
  userId: string,
  email: string,
  data: {
    sellerName: string;
    orderNumber: string;
    itemTitle: string;
    salePrice: string;
    sellerNet: string;
  },
): Promise<void> {
  const { subject, html } = itemSoldEmailTemplate(data);
  await checkPreferenceAndSend(userId, 'ITEM_SOLD', email, subject, html);
}

/**
 * Send password reset email.
 * Always sends — no preference check (security-critical).
 */
export async function sendPasswordResetEmail(
  email: string,
  data: {
    userName: string;
    resetLink: string;
  },
): Promise<void> {
  const { subject, html } = passwordResetEmailTemplate(data);
  await sendEmail(email, subject, html);
}

/**
 * Send dispute opened email to seller.
 * Checks DISPUTE_OPENED notification preference.
 */
export async function sendDisputeOpenedEmail(
  userId: string,
  email: string,
  data: {
    sellerName: string;
    orderNumber: string;
    reason: string;
    descriptionExcerpt: string;
    disputeId: string;
  },
): Promise<void> {
  const { subject, html } = disputeOpenedEmailTemplate(data);
  await checkPreferenceAndSend(userId, 'DISPUTE_OPENED', email, subject, html);
}

/**
 * Send dispute resolved email to buyer or seller.
 * Checks DISPUTE_RESOLVED notification preference.
 */
export async function sendDisputeResolvedEmail(
  userId: string,
  email: string,
  data: {
    userName: string;
    orderNumber: string;
    disputeId: string;
    resolutionType: 'RESOLVED_REFUND' | 'RESOLVED_PARTIAL_REFUND' | 'RESOLVED_NO_REFUND';
    justification: string;
    refundAmount?: string;
    role: 'buyer' | 'seller';
  },
): Promise<void> {
  const { subject, html } = disputeResolvedEmailTemplate(data);
  await checkPreferenceAndSend(userId, 'DISPUTE_RESOLVED', email, subject, html);
}
