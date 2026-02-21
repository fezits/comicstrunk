---
phase: 01-foundation-and-infrastructure
plan: "06b"
type: execute
wave: 3
depends_on:
  - 01-06
files_modified:
  - apps/web/src/components/layout/sidebar.tsx
  - apps/web/src/components/layout/header.tsx
  - apps/web/src/components/layout/theme-toggle.tsx
  - apps/web/src/components/layout/mobile-nav.tsx
  - apps/web/src/app/[locale]/(public)/page.tsx
  - apps/web/src/app/[locale]/(public)/layout.tsx
  - apps/web/src/app/[locale]/(auth)/layout.tsx
  - apps/web/src/app/[locale]/(collector)/layout.tsx
  - apps/web/src/app/[locale]/(seller)/layout.tsx
  - apps/web/src/app/[locale]/(orders)/layout.tsx
  - apps/web/src/app/[locale]/(admin)/layout.tsx
  - apps/web/src/lib/api/client.ts
  - apps/web/src/lib/utils.ts
autonomous: true
requirements:
  - INFRA-08

must_haves:
  truths:
    - "The layout is responsive: sidebar navigation on desktop (1024px+), hamburger menu on mobile/tablet"
    - "Route groups exist: (public), (auth), (collector), (seller), (orders), (admin) — even if most are empty"
    - "The API client is configured with axios interceptors for token refresh"
    - "Theme toggle persists choice across browser refreshes"
  artifacts:
    - path: "apps/web/src/components/layout/sidebar.tsx"
      provides: "Desktop sidebar navigation"
      contains: "Sidebar"
    - path: "apps/web/src/components/layout/header.tsx"
      provides: "Top header bar with logo and controls"
      contains: "Header"
    - path: "apps/web/src/components/layout/theme-toggle.tsx"
      provides: "Dark/light theme toggle component"
      contains: "useTheme"
    - path: "apps/web/src/components/layout/mobile-nav.tsx"
      provides: "Mobile hamburger navigation sheet"
      contains: "Sheet"
    - path: "apps/web/src/lib/api/client.ts"
      provides: "Typed API client with axios interceptors for token refresh"
      exports: ["apiClient", "setAccessToken"]
  key_links:
    - from: "apps/web/src/components/layout/header.tsx"
      to: "apps/web/src/components/layout/theme-toggle.tsx"
      via: "import and render"
      pattern: "ThemeToggle"
    - from: "apps/web/src/components/layout/header.tsx"
      to: "apps/web/src/components/layout/mobile-nav.tsx"
      via: "hamburger trigger"
      pattern: "MobileNav"
    - from: "apps/web/src/lib/api/client.ts"
      to: "apps/api"
      via: "axios baseURL"
      pattern: "NEXT_PUBLIC_API_URL"
    - from: "apps/web/src/app/[locale]/(public)/layout.tsx"
      to: "apps/web/src/components/layout/sidebar.tsx"
      via: "import Sidebar"
      pattern: "Sidebar"
---

<objective>
Build the responsive layout system (sidebar, header, mobile navigation), scaffold all route groups, create the theme toggle component, and set up the typed API client with token refresh interceptor.

Purpose: This delivers the frontend shell — layout, routing structure, and API communication — that all future UI plans build upon. Builds on top of the configuration established in Plan 01-06.
Output: A responsive Next.js app with sidebar nav on desktop, hamburger on mobile, route groups for all future features, and a ready-to-use API client.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-foundation-and-infrastructure/01-RESEARCH.md
@.planning/phases/01-foundation-and-infrastructure/01-01-SUMMARY.md
@.planning/phases/01-foundation-and-infrastructure/01-03-SUMMARY.md
@.planning/phases/01-foundation-and-infrastructure/01-05-SUMMARY.md
@.planning/phases/01-foundation-and-infrastructure/01-06-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Build responsive layout system with sidebar, header, route groups, and API client</name>
  <files>
    apps/web/src/components/layout/sidebar.tsx
    apps/web/src/components/layout/header.tsx
    apps/web/src/components/layout/theme-toggle.tsx
    apps/web/src/components/layout/mobile-nav.tsx
    apps/web/src/app/[locale]/(public)/page.tsx
    apps/web/src/app/[locale]/(public)/layout.tsx
    apps/web/src/app/[locale]/(auth)/layout.tsx
    apps/web/src/app/[locale]/(collector)/layout.tsx
    apps/web/src/app/[locale]/(seller)/layout.tsx
    apps/web/src/app/[locale]/(orders)/layout.tsx
    apps/web/src/app/[locale]/(admin)/layout.tsx
    apps/web/src/lib/api/client.ts
    apps/web/src/lib/utils.ts
  </files>
  <action>
    **Utils (`src/lib/utils.ts`):**
    - `cn()` utility function using clsx + tailwind-merge (standard shadcn/ui pattern)

    **Theme toggle (`src/components/layout/theme-toggle.tsx`):**
    - Client component using `useTheme()` from next-themes
    - Toggle button with sun/moon icons from lucide-react
    - Dropdown with Dark/Light/System options, or simple toggle button
    - Styled with shadcn/ui Button variant="ghost"

    **Header (`src/components/layout/header.tsx`):**
    - Fixed top bar visible on all screen sizes
    - Contains: logo/app name ("Comics Trunk"), theme toggle, user menu (placeholder)
    - On mobile: hamburger menu button that opens the mobile nav sheet
    - On desktop: minimal — most nav is in sidebar
    - Purple-to-blue gradient on the header background per CONTEXT.md decision

    **Sidebar (`src/components/layout/sidebar.tsx`):**
    - Visible on desktop (lg: 1024px+), hidden on mobile/tablet
    - Fixed left sidebar with navigation items organized in groups per CONTEXT.md:
      - Public: Home, Marketplace, Deals
      - My Collection: Collection, Series Progress, Favorites
      - Orders: Cart, My Orders
      - Account: Profile, Settings, Notifications
      - Admin (if admin role): Dashboard, Catalog, Users, Content
    - Each item: icon (lucide-react) + label (translated via useTranslations)
    - Active state indication (highlight current route)
    - Collapsible groups
    - Deep dark background matching the "collector's vault" vibe

    **Mobile nav (`src/components/layout/mobile-nav.tsx`):**
    - Uses shadcn/ui Sheet component (slides in from left)
    - Same navigation structure as Sidebar
    - Triggered by hamburger button in Header
    - Closes on navigation

    **Route group layouts:**
    - `(public)/layout.tsx`: header + sidebar layout (sidebar + main content area)
    - `(public)/page.tsx`: simple landing page placeholder with "Welcome to Comics Trunk" in PT-BR, styled with the dark immersive vibe
    - `(auth)/layout.tsx`: centered card layout per CONTEXT.md ("centered card for public/auth pages") — no sidebar, just centered content with background
    - `(collector)/layout.tsx`: header + sidebar layout (reuse same shell — will be populated in Phase 3)
    - `(seller)/layout.tsx`: header + sidebar layout (future Phase 4)
    - `(orders)/layout.tsx`: header + sidebar layout (future Phase 4)
    - `(admin)/layout.tsx`: header + sidebar layout with admin-specific nav (future Phase 10)

    Each future route group layout can be a simple pass-through for now, with a layout component that wraps children in the sidebar shell.

    **Responsive breakpoints per INFRA-08:**
    - Mobile: < 768px (no sidebar, hamburger menu, stacked layout)
    - Tablet: 768-1023px (no sidebar, hamburger menu, wider content)
    - Desktop: 1024px+ (sidebar visible, full layout)

    **API client (`src/lib/api/client.ts`):**
    Follow the exact pattern from research Code Examples section:
    - Axios instance with baseURL from NEXT_PUBLIC_API_URL
    - withCredentials: true (for httpOnly cookie refresh)
    - In-memory access token variable
    - Request interceptor: attach Bearer token
    - Response interceptor: on 401, coordinate single refresh attempt (avoid race condition)
    - If refresh fails: clear token, redirect to /pt-BR/login
    - Export: apiClient, setAccessToken, getAccessToken

    **Feedback patterns per CONTEXT.md:**
    - Skeleton loading components (use shadcn/ui Skeleton)
    - Toast notifications (sonner already in locale layout)
    - Ensure layout supports confirmation modals and badges (shadcn/ui Dialog and Badge already installed)
  </action>
  <verify>
    - `pnpm --filter web dev` starts
    - Visit http://localhost:3000/pt-BR — shows landing page with sidebar on desktop
    - Resize to mobile (< 768px) — sidebar disappears, hamburger appears
    - Click hamburger — mobile nav sheet opens
    - Click theme toggle — switches between dark and light mode
    - Refresh browser — theme choice persists
    - Route groups exist: navigate to /pt-BR and see the public layout
    - Browser console shows no errors
  </verify>
  <done>
    Responsive layout system is complete: sidebar navigation on desktop, hamburger + sheet on mobile, theme toggle with persistence, all route groups scaffolded. API client with token refresh interceptor is ready. The frontend has the dark immersive collector's vault feel with purple accent colors.
  </done>
</task>

</tasks>

<verification>
- Theme toggle works and persists across refreshes (localStorage)
- All nav items are in PT-BR (check nav items, page content, button labels)
- Sidebar shows on desktop (1024px+), hamburger menu on mobile
- Route group directories exist: (public), (auth), (collector), (seller), (orders), (admin)
- API client exists with axios interceptors for token refresh
- `pnpm --filter web build` produces standalone output
</verification>

<success_criteria>
The responsive layout shell is complete with sidebar navigation on desktop, hamburger menu on mobile/tablet, theme toggle with persistence, all route groups scaffolded, and a typed API client with token refresh interceptor ready for auth UI integration.
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation-and-infrastructure/01-06b-SUMMARY.md`
</output>
