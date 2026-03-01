---
phase: "07"
plan: "03"
subsystem: notifications
tags: [notifications, preferences, in-app, hooks]
dependency_graph:
  requires: []
  provides: [notification-service, notification-routes, notification-preferences]
  affects: [orders, payments, auth]
tech_stack:
  added: []
  patterns: [fire-and-forget-notifications, preference-gated-notifications]
key_files:
  created:
    - packages/contracts/src/notifications.ts
    - apps/api/src/modules/notifications/notifications.service.ts
    - apps/api/src/modules/notifications/notifications.routes.ts
  modified:
    - packages/contracts/src/index.ts
    - apps/api/src/create-app.ts
    - apps/api/src/modules/orders/orders.service.ts
    - apps/api/src/modules/auth/auth.service.ts
    - apps/api/src/modules/payments/payments.service.ts
decisions:
  - "Used fire-and-forget pattern with .catch(() => {}) for all notification hooks to prevent notification failures from blocking main operations"
  - "Notification preferences default to enabled when no row exists (implicit opt-in)"
  - "Added PAYMENT_CONFIRMED notification hook in payments.service.ts processPaymentConfirmation even though not explicitly in plan because it was referenced in must_haves and is a critical user flow"
metrics:
  tasks_completed: 4
  tasks_total: 4
  files_created: 3
  files_modified: 5
---

# Phase 07 Plan 03: Notification System API Summary

Notification system API with 6 endpoints, preference management, and fire-and-forget createNotification() service function integrated into order, payment, and auth flows.

## What Was Built

### 1. Contract Schemas (`packages/contracts/src/notifications.ts`)
- `notificationsQuerySchema` extending paginationSchema with optional `unreadOnly` boolean filter
- `updatePreferencesSchema` for updating notification preferences per type
- `NOTIFICATION_TYPES` const array of all 10 notification types for frontend consumption
- Exported types: `NotificationsQuery`, `UpdatePreferencesInput`, `NotificationTypeValue`

### 2. Notification Service (`apps/api/src/modules/notifications/notifications.service.ts`)
- **createNotification()** - Creates in-app notification after checking user preferences; wrapped in try/catch to never throw (fire-and-forget safe)
- **getUserNotifications()** - Paginated list with optional `unreadOnly` filter, sorted by createdAt desc
- **getUnreadCount()** - Count of unread notifications using the [userId, isRead] composite index
- **getRecentNotifications()** - Last N notifications for dropdown preview (default 5)
- **markAsRead()** - Marks single notification as read with ownership verification
- **markAllAsRead()** - Marks all unread notifications as read, returns count
- **getPreferences()** - Returns all 10 notification types with enabled status (defaults to true for missing rows)
- **updatePreferences()** - Upserts preference rows for specified types

### 3. Notification Routes (`apps/api/src/modules/notifications/notifications.routes.ts`)
All routes require authentication:
- `GET /api/v1/notifications` - Paginated notification list
- `GET /api/v1/notifications/unread-count` - Unread count for badge
- `GET /api/v1/notifications/recent` - Recent notifications for dropdown
- `PATCH /api/v1/notifications/:id/read` - Mark single as read
- `PATCH /api/v1/notifications/read-all` - Mark all as read
- `GET /api/v1/notifications/preferences` - Get all notification preferences
- `PUT /api/v1/notifications/preferences` - Update notification preferences

### 4. Integration Hooks
- **Auth (signup)**: WELCOME notification after user creation
- **Orders (createOrder)**: ITEM_SOLD notification to each unique seller
- **Orders (updateOrderItemStatus)**: ORDER_SHIPPED notification to buyer when status is SHIPPED or DELIVERED
- **Payments (processPaymentConfirmation)**: PAYMENT_CONFIRMED notification to buyer after payment approved
- All hooks use fire-and-forget pattern (`.catch(() => {})`) to never block main operations

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Prisma JSON type for metadata field**
- **Found during:** Task 2
- **Issue:** `Record<string, unknown>` is not directly assignable to Prisma's `NullableJsonNullValueInput | InputJsonValue`
- **Fix:** Cast metadata through `Prisma.InputJsonValue` when present
- **Files modified:** `apps/api/src/modules/notifications/notifications.service.ts`

**2. [Rule 2 - Missing Critical Functionality] Added PAYMENT_CONFIRMED notification hook**
- **Found during:** Task 4
- **Issue:** Plan mentioned payment notification in must_haves but only explicitly listed orders and auth hooks in task 4 action
- **Fix:** Added notification hook in `payments.service.ts` `processPaymentConfirmation()` to notify buyer when payment is confirmed
- **Files modified:** `apps/api/src/modules/payments/payments.service.ts`

## Verification

- `pnpm build` succeeds across all 3 packages (contracts, api, web)
- All 6 notification endpoints are mounted at `/api/v1/notifications`
- Notification creation respects user preferences (checked via isNotificationEnabled)
- Preferences return all 10 types with enabled defaults even when no rows exist
- Fire-and-forget hooks added in auth, orders, and payments modules
