# Phase 7: Community and Notifications — Research

**Date:** 2026-02-28
**Phase Goal:** Users can engage with the catalog through reviews, comments, and favorites; buyers and sellers can rate each other after transactions; and the platform communicates proactively via in-app notifications and transactional emails.

## Requirements Covered

| ID | Description | Category |
|----|-------------|----------|
| SHIP-05 | Buyer notified of shipping updates | Shipping |
| SOCL-01 | User can rate a catalog entry (1-5 stars + text review, one per user per catalog) | Social |
| SOCL-02 | User can edit their own review | Social |
| SOCL-03 | Buyer can rate seller after completed purchase (1-5 stars + review, one per transaction) | Social |
| SOCL-04 | Average rating displayed on catalog entries and seller profiles | Social |
| SOCL-05 | User can favorite catalog entries and access favorites list | Social |
| SOCL-06 | User can comment on catalog entries (with one level of reply nesting) | Social |
| SOCL-07 | User can like comments | Social |
| NOTF-01 | In-app notification bell icon with unread badge and dropdown preview | Notifications |
| NOTF-02 | Full notifications page | Notifications |
| NOTF-03 | Email: welcome on signup | Notifications |
| NOTF-04 | Email: payment confirmation with order details | Notifications |
| NOTF-05 | Email: shipping notification with tracking code | Notifications |
| NOTF-06 | Email: sale notification to seller | Notifications |
| NOTF-07 | Email: password reset link | Notifications |
| NOTF-08 | Simple notification preferences (on/off per type) | Notifications |
| NOTF-09 | All emails with responsive layout and consistent branding | Notifications |

## Prisma Models (Already Defined in schema.prisma)

### Review
- Fields: `id`, `userId`, `catalogEntryId` (nullable), `sellerId` (nullable), `orderId` (nullable), `rating` (Int), `text` (Text, nullable), `createdAt`, `updatedAt`
- Unique constraints: `@@unique([userId, catalogEntryId])` for catalog reviews, `@@unique([userId, sellerId, orderId])` for seller reviews
- Relations: User, CatalogEntry (optional), Order (optional)
- Indexes: catalogEntryId, sellerId, orderId
- **Key insight**: The `sellerId` field has no formal relation to User — it is stored as a plain string. The Review model only has a direct relation to User via `userId` (the reviewer). Seller reviews link to Order for the purchase-gate validation.

### Comment
- Fields: `id`, `userId`, `catalogEntryId`, `parentId` (nullable, self-relation for replies), `content` (Text), `likesCount` (Int, default 0), `createdAt`, `updatedAt`
- Relations: User, CatalogEntry, self-referential `parent`/`replies` via "CommentReplies"
- Indexes: userId, catalogEntryId, parentId
- **Key insight**: One nesting level enforced at application layer (reject parentId if target comment already has a parentId).

### CommentLike
- Fields: `id`, `userId`, `commentId`, `createdAt`
- Unique constraint: `@@unique([userId, commentId])` (toggle behavior)
- Relations: User (onDelete: Cascade), Comment (onDelete: Cascade)

### Favorite
- Fields: `id`, `userId`, `catalogEntryId`, `createdAt`
- Unique constraint: `@@unique([userId, catalogEntryId])` (toggle behavior)
- Relations: User (onDelete: Cascade), CatalogEntry (onDelete: Cascade)

### Notification
- Fields: `id`, `userId`, `type` (NotificationType enum), `title`, `message` (Text), `isRead` (Boolean, default false), `readAt` (nullable), `metadata` (Json, nullable), `createdAt`
- Indexes: userId, `[userId, isRead]` (for unread count query), type
- **Key insight**: `metadata` JSON field can store contextual links (orderId, catalogEntryId, etc.) for frontend navigation.

### NotificationPreference
- Fields: `id`, `userId`, `type` (NotificationType enum), `enabled` (Boolean, default true), `createdAt`, `updatedAt`
- Unique constraint: `@@unique([userId, type])`
- **Key insight**: Default `enabled=true` means all notifications are on unless the user explicitly disables them. Missing rows imply enabled.

### NotificationType Enum
```
WELCOME, PAYMENT_CONFIRMED, ORDER_SHIPPED, ITEM_SOLD, PASSWORD_RESET,
DISPUTE_OPENED, DISPUTE_RESPONDED, DISPUTE_RESOLVED,
SUBSCRIPTION_PAYMENT_FAILED, SUBSCRIPTION_EXPIRED
```

## CatalogEntry Rating Fields
- `averageRating`: Decimal(3,2), default 0
- `ratingCount`: Int, default 0
- These must be updated atomically whenever a review is created, updated, or deleted.

## Order Service — Completion Gate for Seller Reviews
- `orders.service.ts` contains `updateOrderItemStatus()` which transitions items through PENDING -> PAID -> PROCESSING -> SHIPPED -> DELIVERED -> COMPLETED
- When `newStatus === 'COMPLETED'`, collection item is marked as no longer for sale
- `syncOrderStatus()` checks if all items reached terminal state and updates order status
- **Seller review gate**: Before allowing a seller review, the service must verify the order status is COMPLETED (all items delivered and confirmed by buyer), and the reviewer is the buyer on that order.

## Existing Patterns to Follow

### Module Pattern (API)
Each module follows `src/modules/{feature}/`:
- `{feature}.routes.ts` — Express Router, validation middleware, calls service, returns via `sendSuccess`/`sendPaginated`
- `{feature}.service.ts` — All business logic, uses Prisma directly
- Route mounting in `src/create-app.ts`: `app.use('/api/v1/{feature}', featureRoutes)`

### SDK Abstraction Pattern
Both `shared/lib/mercadopago.ts` and `shared/lib/stripe.ts` follow the same pattern:
1. Read env var for credentials
2. Conditionally initialize SDK client (null if not configured)
3. Export client instance + `isXxxConfigured()` boolean check
4. Export utility functions (webhook verification, etc.)
- **Resend SDK** should follow this exact pattern at `shared/lib/resend.ts`.

### Contracts Pattern
- Each feature has its own file in `packages/contracts/src/{feature}.ts`
- Exports Zod schemas + inferred TypeScript types
- Re-exported from `packages/contracts/src/index.ts`

### Navigation Pattern (Web)
- `nav-config.ts` defines `NavGroup[]` with `requiresAuth`, `adminOnly` flags
- Favorites already has a nav item: `{ titleKey: 'nav.favorites', href: '/favorites', icon: Heart }`
- Notifications route `/notifications` is already in `protectedRoutes` array
- Bell icon already in `header.tsx` but links statically to `/notifications` without dropdown or unread badge

### Translation Pattern (Web)
- All UI strings in `apps/web/src/messages/pt-BR.json`
- Accessed via `useTranslations()` hook from next-intl
- Nested structure: `{ "feature": { "key": "value" } }`

### Cron Pattern
- `shared/cron/index.ts` registers all cron jobs in `registerCronJobs()`
- Uses `node-cron` with standard cron expressions
- Each job is wrapped in try/catch with console logging

### Feature Components (Web)
- Feature components live in `apps/web/src/components/features/{feature}/`
- UI primitives in `apps/web/src/components/ui/` (shadcn/ui)

## Integration Points

### Review → CatalogEntry
When a catalog review is created/updated/deleted, `averageRating` and `ratingCount` on CatalogEntry must be recalculated. Use a helper function that runs `AVG(rating)` and `COUNT(*)` on reviews where `catalogEntryId = X`, then updates the catalog entry atomically.

### Review → Order (Seller Reviews)
Seller reviews require:
1. The order must exist and be in COMPLETED status
2. The reviewer (userId) must be the buyer on the order
3. The sellerId must be a seller on that order's items
4. Only one review per (userId, sellerId, orderId) — enforced by unique constraint

### Notification → Multiple Modules
The notification service will be called from:
- Auth module (welcome email on signup, password reset email)
- Payments module (payment confirmed)
- Orders/Shipping module (shipping update, sale alert)
- Subscriptions module (already creating notifications in cron job)
- Disputes module (future Phase 8)
The service should be a standalone utility (`shared/services/notification.service.ts` or `modules/notifications/notifications.service.ts`) that other modules can import.

### Email → Notification Preferences
Before sending any email, the email service must check if the user has that notification type enabled. The check is: find NotificationPreference where userId + type; if no row exists, default to enabled (since model default is `enabled: true`).

## Technical Decisions

1. **Resend SDK**: Use `resend` npm package. Abstract behind `shared/lib/resend.ts` following mercadopago/stripe pattern. Env var: `RESEND_API_KEY`.

2. **Email Templates**: Use React Email (`@react-email/components`) for type-safe, component-based email templates. Templates stored in `apps/api/src/shared/email-templates/`. Each template is a function that takes data and returns HTML string.

3. **Notification Service Architecture**: Create `apps/api/src/modules/notifications/` with:
   - `notifications.service.ts` — CRUD for notifications, preference checks, unread count
   - `notifications.routes.ts` — API endpoints for frontend consumption
   - The service exports a `createNotification()` function that other modules call to create in-app notifications.

4. **Email Service Architecture**: Create `apps/api/src/shared/lib/resend.ts` for SDK abstraction and `apps/api/src/modules/notifications/email.service.ts` for email sending logic. The email service checks preferences before sending and uses templates.

5. **Polling for Notifications**: v1 uses polling (GET every 30-60s for unread count). SSE/WebSocket is deferred to v2 (NOTF-V2-01).

6. **Star Rating Component**: Build a reusable `<StarRating>` component in `components/ui/star-rating.tsx` that supports both display and input modes.

## Wave Strategy

| Wave | Plans | Rationale |
|------|-------|-----------|
| Wave 1 | 07-01, 07-02, 07-03 | Three independent backend APIs with no cross-dependencies |
| Wave 2 | 07-04 | Email service depends on notification service from 07-03 for preference checks |
| Wave 3 | 07-05, 07-06, 07-07 | Three frontend plans consuming the APIs from Waves 1-2 |

## Risk Factors

1. **Rating aggregation consistency**: Must use database-level aggregation (not application-level caching) to ensure `averageRating` stays accurate. Wrap in transactions.
2. **Email deliverability**: Resend requires domain verification. In dev, emails go to sandbox. Plan must account for graceful degradation when RESEND_API_KEY is not set.
3. **Notification creation from existing modules**: Plans 07-03 and 07-04 will need to hook into existing auth, payment, and order flows. These hooks should be added as part of those plans, not retroactively.
4. **Comment nesting depth**: Must enforce exactly one level at application layer. A reply to a reply should be rejected (parentId's parent must be null).
