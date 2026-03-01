import { NotificationType } from '@prisma/client';
import { resend, isResendConfigured, RESEND_FROM_EMAIL } from '../../shared/lib/resend';
import { isNotificationEnabled } from './notifications.service';
import { welcomeEmailTemplate } from '../../shared/email-templates/welcome';
import { paymentConfirmedEmailTemplate } from '../../shared/email-templates/payment-confirmed';
import { orderShippedEmailTemplate } from '../../shared/email-templates/order-shipped';
import { itemSoldEmailTemplate } from '../../shared/email-templates/item-sold';
import { passwordResetEmailTemplate } from '../../shared/email-templates/password-reset';

// === Internal helper: send a single email ===

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!isResendConfigured() || !resend) {
    console.log(`[EMAIL] Resend not configured, skipping: ${subject} -> ${to}`);
    return;
  }

  try {
    await resend.emails.send({
      from: RESEND_FROM_EMAIL,
      to,
      subject,
      html,
    });
  } catch (error) {
    console.error(`[EMAIL] Failed to send email: ${subject} -> ${to}`, error);
    // Fire-and-forget: never throw from email sending
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
