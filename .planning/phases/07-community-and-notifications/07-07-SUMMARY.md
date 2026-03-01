---
phase: "07"
plan: "07"
subsystem: notification-ui
tags: [notifications, bell, dropdown, preferences, polling, ui]
dependency_graph:
  requires: [notification-service, notification-routes, notification-preferences]
  provides: [notification-bell, notification-dropdown, notifications-page, notification-preferences-ui]
  affects: [header, layout, nav-config]
tech_stack:
  added: [radix-popover, radix-tooltip]
  patterns: [notification-polling-context, popover-dropdown, optimistic-preference-toggle]
key_files:
  created:
    - apps/web/src/lib/api/notifications.ts
    - apps/web/src/contexts/notification-context.tsx
    - apps/web/src/components/features/notifications/notification-bell.tsx
    - apps/web/src/components/features/notifications/notification-dropdown.tsx
    - apps/web/src/components/features/notifications/notification-item.tsx
    - apps/web/src/components/features/notifications/notifications-page.tsx
    - apps/web/src/components/features/notifications/notification-preferences.tsx
    - apps/web/src/app/[locale]/(collector)/notifications/page.tsx
    - apps/web/src/app/[locale]/(collector)/notifications/preferences/page.tsx
    - apps/web/src/components/ui/popover.tsx
    - apps/web/src/components/ui/tooltip.tsx
  modified:
    - apps/web/src/components/layout/header.tsx
    - apps/web/src/components/layout/nav-config.ts
    - apps/web/src/app/[locale]/layout.tsx
    - apps/web/src/messages/pt-BR.json
decisions:
  - "Used Radix Popover for bell dropdown instead of DropdownMenu to allow richer content layout with header, scrollable list, and footer"
  - "Notification preferences use optimistic toggle with auto-save per type instead of a form-based save button"
  - "Polling interval set to 30 seconds via NotificationProvider context that wraps the entire app"
  - "Red destructive badge for unread count (matches common UX pattern) with 99+ cap"
  - "PASSWORD_RESET preference locked as always-enabled with shield icon and tooltip explanation"
metrics:
  tasks_completed: 3
  tasks_total: 3
  files_created: 11
  files_modified: 4
---

# Phase 07 Plan 07: Notification UI Summary

Bell icon with unread count badge, popover dropdown with recent notifications, full notifications page with pagination and read/unread filters, and notification preferences page with per-type toggles. All text localized in PT-BR via next-intl.

## What Was Built

### 1. Notifications API Client (`apps/web/src/lib/api/notifications.ts`)
- `getNotifications()` - Paginated list with optional unreadOnly filter
- `getUnreadCount()` - Single count for badge display
- `getRecentNotifications()` - Last 5 for dropdown preview
- `markAsRead()` - Mark single notification as read
- `markAllAsRead()` - Bulk mark all as read
- `getPreferences()` - Get all notification type preferences
- `updatePreferences()` - Update preferences per type
- Full TypeScript types for Notification, NotificationPreference, PaginatedNotifications

### 2. Notification Context (`apps/web/src/contexts/notification-context.tsx`)
- `NotificationProvider` wraps the app inside CartProvider in layout.tsx
- Exposes `unreadCount`, `isLoading`, `refreshUnreadCount()` via `useNotifications()` hook
- Polls `getUnreadCount()` every 30 seconds while user is authenticated
- Stops polling and resets count to 0 on logout
- Uses cleanup to clear interval on unmount

### 3. NotificationBell (`apps/web/src/components/features/notifications/notification-bell.tsx`)
- Bell icon from lucide-react with red badge showing unread count (99+ cap)
- Uses Radix Popover to open the notification dropdown on click
- Accessible aria-label with unread count in PT-BR
- Integrated into header.tsx replacing the previous static Bell link

### 4. NotificationDropdown (`apps/web/src/components/features/notifications/notification-dropdown.tsx`)
- Fetches 5 most recent notifications when opened
- Header with title and unread count
- "Marcar todas como lidas" button (visible only when unread > 0)
- Loading skeleton state
- Empty state with bell icon and message
- "Ver todas as notificacoes" link to /notifications
- Uses ScrollArea for overflow handling

### 5. NotificationItem (`apps/web/src/components/features/notifications/notification-item.tsx`)
- Type-specific icon mapping (Gift, CreditCard, Truck, DollarSign, KeyRound, AlertTriangle, Crown)
- Title (bold when unread), message preview (line-clamp), relative time ago
- Unread indicator: left purple border + colored icon background + dot
- Click marks as read and navigates to related content via metadata (orderId, catalogEntryId)
- Compact mode for dropdown (smaller padding, single-line message)

### 6. NotificationsPage (`apps/web/src/components/features/notifications/notifications-page.tsx`)
- Full page at /notifications with paginated list (20 per page)
- Filter tabs: "Todas" / "Nao lidas" with unread count badge
- "Marcar todas como lidas" button in page header
- "Gerenciar preferencias" link to /notifications/preferences
- Empty state with bell icon
- Pagination controls

### 7. NotificationPreferences (`apps/web/src/components/features/notifications/notification-preferences.tsx`)
- Grouped by category: Pedidos, Comunidade, Conta
- Toggle switch per notification type with auto-save on toggle
- PASSWORD_RESET type locked as always-enabled with ShieldCheck icon and tooltip
- Optimistic UI updates with rollback on error
- Success toast on save
- Back link to /notifications

### 8. Header Integration
- Replaced static Bell icon + Link with `<NotificationBell />` component
- Removed unused Bell import from lucide-react in header
- NotificationBell handles its own popover and navigation

### 9. Layout & Navigation
- NotificationProvider added to layout.tsx inside AuthProvider > CartProvider > NotificationProvider
- Bell icon added to nav-config.ts account group (between Profile and Subscription)
- /notifications/preferences added to protectedRoutes array

### 10. Translations (PT-BR)
- Full `notifications` section in pt-BR.json with:
  - Page titles, filter labels, action buttons
  - Time ago strings (agora, ha Xmin, ha Xh, ha Xd, ontem)
  - All 10 notification type labels
  - Category group labels (Pedidos, Comunidade, Conta)
  - Bell aria-label with count interpolation
  - Preference save confirmation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing shadcn Popover and Tooltip components**
- **Found during:** Task 2
- **Issue:** Popover component not yet installed in shadcn/ui collection; needed for bell dropdown. Tooltip also needed for PASSWORD_RESET locked toggle explanation.
- **Fix:** Ran `npx shadcn@latest add popover tooltip` to install both components
- **Files created:** `apps/web/src/components/ui/popover.tsx`, `apps/web/src/components/ui/tooltip.tsx`

## Verification

- `pnpm --filter web exec tsc --noEmit` passes with zero errors
- `pnpm --filter web build` succeeds with both notification routes in output
- /[locale]/notifications route (8.63 kB) and /[locale]/notifications/preferences route (9.56 kB) present in build output
- NotificationBell integrated in header with popover dropdown
- NotificationProvider wraps the app in layout.tsx
- All UI text uses next-intl translations in PT-BR
- nav-config.ts includes Notifications in account group and in protectedRoutes
