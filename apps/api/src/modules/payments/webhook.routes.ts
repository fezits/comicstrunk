import { Router } from 'express';
import { validateWebhookSignature } from '../../shared/lib/mercadopago';
import * as paymentsService from './payments.service';
import type { Request, Response, NextFunction } from 'express';

const router = Router();

// POST / — Mercado Pago webhook handler
// NO authenticate middleware — Mercado Pago sends webhooks without JWT
router.post(
  '/',
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const xSignature = req.headers['x-signature'] as string | undefined;
      const xRequestId = req.headers['x-request-id'] as string | undefined;
      const body = req.body as {
        id?: number;
        type?: string;
        action?: string;
        data?: { id?: string };
      };

      const dataId = body.data?.id ? String(body.data.id) : undefined;

      // 1. Validate signature if x-signature header is present
      if (xSignature && process.env.MERCADOPAGO_WEBHOOK_SECRET) {
        const isValid = validateWebhookSignature(
          xSignature,
          xRequestId ?? '',
          dataId ?? '',
        );
        if (!isValid) {
          console.warn('[Webhook] Invalid signature received');
          res.status(401).json({ message: 'Invalid webhook signature' });
          return;
        }
      }

      // 2. Build event identifiers
      const eventId = String(body.id ?? dataId ?? Date.now());
      const eventType = body.action ?? body.type ?? 'unknown';

      // 3. Process the webhook event (idempotency handled inside)
      await paymentsService.processWebhookEvent(eventId, eventType, body, dataId);

      // 4. Always return 200 to acknowledge receipt
      res.status(200).json({ received: true });
    } catch (error) {
      // Log error but still return 200 to prevent Mercado Pago retries
      // for non-recoverable errors. MP will retry on non-200 responses.
      console.error('[Webhook] Unhandled error:', error);
      res.status(200).json({ received: true });
    }
  },
);

export const webhookRoutes: Router = router;
