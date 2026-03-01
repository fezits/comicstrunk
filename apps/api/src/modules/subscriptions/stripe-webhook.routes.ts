import { Router } from 'express';
import { processStripeWebhook } from './stripe-webhook.service';
import type { Request, Response } from 'express';

const router = Router();

// POST / — Stripe webhook handler
// NO authenticate middleware — Stripe sends webhooks with signature verification, not JWT
// Request body is a raw Buffer (express.raw() applied in create-app.ts)
router.post('/', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['stripe-signature'] as string | undefined;

    if (!signature) {
      res.status(400).json({ error: 'Missing stripe-signature header' });
      return;
    }

    // req.body is a Buffer because express.raw({ type: 'application/json' })
    // is applied before this route in create-app.ts
    await processStripeWebhook(req.body as Buffer, signature);

    res.status(200).json({ received: true });
  } catch (error) {
    // Log error but still return 200 to prevent Stripe retries
    // for non-recoverable errors. Stripe will retry on non-200 responses.
    console.error('[Stripe Webhook] Unhandled error:', error);
    res.status(200).json({ received: true });
  }
});

export const stripeWebhookRoutes: Router = router;
