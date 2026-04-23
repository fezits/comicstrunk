# Missing Pages: Cart, Profile & Settings — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the 3 missing pages (`/cart`, `/profile`, `/settings`) that are referenced in navigation but return 404, plus their API client functions and translations.

**Architecture:** Each page follows the established collector page pattern — a thin `page.tsx` that delegates to a feature component in `components/features/`. All text uses `next-intl` translations from `messages/pt-BR.json`. The cart page reuses existing cart components (`CartItemCard`, `CartSummary`). The profile page introduces a new API client (`lib/api/users.ts`) and a form component. The settings page is a simple hub linking to existing pages.

**Tech Stack:** Next.js 15 App Router, React 19, next-intl, shadcn/ui (Radix), Tailwind CSS, Axios, Zod (contracts), Sonner (toasts)

---

## File Structure

### New Files
| File | Responsibility |
|---|---|
| `apps/web/src/app/[locale]/(collector)/cart/page.tsx` | Cart page route — delegates to `CartPage` component |
| `apps/web/src/components/features/cart/cart-page.tsx` | Full-page cart view reusing `CartItemCard` + `CartSummary` |
| `apps/web/src/lib/api/users.ts` | API client for `GET /users/profile` and `PUT /users/profile` |
| `apps/web/src/app/[locale]/(collector)/profile/page.tsx` | Profile page route — delegates to `ProfilePage` component |
| `apps/web/src/components/features/profile/profile-page.tsx` | Profile view + edit form |
| `apps/web/src/app/[locale]/(collector)/settings/page.tsx` | Settings page route — delegates to `SettingsPage` component |
| `apps/web/src/components/features/settings/settings-page.tsx` | Settings hub with links to existing config pages |

### Modified Files
| File | Change |
|---|---|
| `apps/web/src/messages/pt-BR.json` | Add `profile`, `settings` translation keys; extend `cart` keys for page |

---

## Task 1: Cart Page

The cart already works as a sidebar (`CartSidebar` + `CartItemCard` + `CartSummary`). This page provides a full-page alternative, better on mobile.

**Files:**
- Create: `apps/web/src/app/[locale]/(collector)/cart/page.tsx`
- Create: `apps/web/src/components/features/cart/cart-page.tsx`
- Modify: `apps/web/src/messages/pt-BR.json` (extend `cart` namespace)

### Steps

- [ ] **Step 1: Add cart page translations**

In `apps/web/src/messages/pt-BR.json`, add these keys inside the existing `"cart"` object (after `"cartCleared"`):

```json
"pageTitle": "Meu Carrinho",
"continueShopping": "Continuar comprando",
"itemsInCart": "{count, plural, one {# item no carrinho} other {# itens no carrinho}}"
```

- [ ] **Step 2: Create the cart page component**

Create `apps/web/src/components/features/cart/cart-page.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { ShoppingBag, ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CartItemCard } from './cart-item-card';
import { CartSummary } from './cart-summary';
import { useCart } from '@/contexts/cart-context';

export function CartPage() {
  const t = useTranslations('cart');
  const locale = useLocale();
  const { cartItems, isLoading, refreshCart } = useCart();

  const handleItemRemoved = () => {
    refreshCart();
  };

  const handleCleared = () => {
    // CartSummary refreshes internally
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <ShoppingBag className="h-16 w-16 text-muted-foreground/30" />
        <p className="text-lg font-medium text-muted-foreground">{t('empty')}</p>
        <Button asChild variant="outline">
          <Link href={`/${locale}/marketplace`}>{t('browseMarketplace')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('pageTitle')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('itemsInCart', { count: cartItems.length })}
          </p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/${locale}/marketplace`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('continueShopping')}
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3">
          {cartItems.map((item) => (
            <CartItemCard
              key={item.id}
              item={item}
              onRemoved={handleItemRemoved}
            />
          ))}
        </div>

        <div>
          <CartSummary
            items={cartItems}
            onCleared={handleCleared}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Check CartSummary accepts optional onClose**

The `CartSummary` component receives `onClose` from the sidebar. The cart page doesn't pass it. Verify `CartSummary` handles missing `onClose` gracefully.

Open `apps/web/src/components/features/cart/cart-summary.tsx` and check the `onClose` prop. If it's required, make it optional:

```tsx
// In the interface, ensure onClose is optional:
interface CartSummaryProps {
  items: CartItem[];
  onCleared: () => void;
  onClose?: () => void;  // Must be optional
}
```

- [ ] **Step 4: Create the page route**

Create `apps/web/src/app/[locale]/(collector)/cart/page.tsx`:

```tsx
'use client';

import { CartPage } from '@/components/features/cart/cart-page';

export default function CartRoute() {
  return <CartPage />;
}
```

- [ ] **Step 5: Test manually**

1. Run `pnpm dev` (or verify it's running)
2. Navigate to `http://localhost:3000/pt-BR/cart`
3. Verify: empty state shows when cart is empty (bag icon + "Explorar marketplace" link)
4. Add an item to cart from marketplace, navigate to `/cart` again
5. Verify: items display with countdown, summary shows total, checkout button works
6. Test mobile viewport (sidebar should still work independently)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/\[locale\]/\(collector\)/cart/page.tsx \
       apps/web/src/components/features/cart/cart-page.tsx \
       apps/web/src/messages/pt-BR.json
# Also add cart-summary.tsx if modified
git commit -m "feat: add full-page cart view for better mobile UX"
```

---

## Task 2: Users API Client

The profile page needs an API client to fetch and update the user profile. This is a standalone dependency.

**Files:**
- Create: `apps/web/src/lib/api/users.ts`

### Steps

- [ ] **Step 1: Create the users API client**

Create `apps/web/src/lib/api/users.ts`:

```tsx
import apiClient from './client';

// === Types ===

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl: string | null;
  bio: string | null;
  websiteUrl: string | null;
  twitterHandle: string | null;
  instagramHandle: string | null;
  createdAt: string;
}

export interface UpdateProfileInput {
  name?: string;
  bio?: string;
  websiteUrl?: string;
  twitterHandle?: string;
  instagramHandle?: string;
}

// === API Calls ===

export async function getProfile(): Promise<UserProfile> {
  const response = await apiClient.get('/users/profile');
  return response.data.data;
}

export async function updateProfile(data: UpdateProfileInput): Promise<UserProfile> {
  const response = await apiClient.put('/users/profile', data);
  return response.data.data;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/api/users.ts
git commit -m "feat: add users API client for profile fetch and update"
```

---

## Task 3: Profile Page

Full profile page with view and edit form. Uses the API client from Task 2.

**Files:**
- Create: `apps/web/src/app/[locale]/(collector)/profile/page.tsx`
- Create: `apps/web/src/components/features/profile/profile-page.tsx`
- Modify: `apps/web/src/messages/pt-BR.json` (add `profile` namespace)

### Steps

- [ ] **Step 1: Add profile translations**

In `apps/web/src/messages/pt-BR.json`, add a new `"profile"` top-level key:

```json
"profile": {
  "title": "Meu Perfil",
  "personalInfo": "Informacoes Pessoais",
  "socialLinks": "Redes Sociais",
  "name": "Nome",
  "email": "E-mail",
  "bio": "Bio",
  "bioPlaceholder": "Conte um pouco sobre voce e sua colecao...",
  "website": "Website",
  "websitePlaceholder": "https://seusite.com",
  "twitter": "Twitter / X",
  "twitterPlaceholder": "seu_usuario",
  "instagram": "Instagram",
  "instagramPlaceholder": "seu_usuario",
  "memberSince": "Membro desde",
  "save": "Salvar Alteracoes",
  "saving": "Salvando...",
  "saved": "Perfil atualizado com sucesso",
  "error": "Erro ao atualizar perfil",
  "loadError": "Erro ao carregar perfil"
}
```

- [ ] **Step 2: Create the profile page component**

Create `apps/web/src/components/features/profile/profile-page.tsx`:

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { User, Globe, Twitter, Instagram, Calendar } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getProfile, updateProfile, type UserProfile, type UpdateProfileInput } from '@/lib/api/users';

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function ProfilePage() {
  const t = useTranslations('profile');

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [twitterHandle, setTwitterHandle] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');

  const fetchProfile = useCallback(async () => {
    try {
      const data = await getProfile();
      setProfile(data);
      setName(data.name);
      setBio(data.bio ?? '');
      setWebsiteUrl(data.websiteUrl ?? '');
      setTwitterHandle(data.twitterHandle ?? '');
      setInstagramHandle(data.instagramHandle ?? '');
    } catch {
      toast.error(t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const input: UpdateProfileInput = {
        name: name.trim(),
        bio: bio.trim(),
        websiteUrl: websiteUrl.trim(),
        twitterHandle: twitterHandle.trim(),
        instagramHandle: instagramHandle.trim(),
      };
      const updated = await updateProfile(input);
      setProfile(updated);
      toast.success(t('saved'));
    } catch {
      toast.error(t('error'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Avatar + Info Card */}
        <Card>
          <CardContent className="flex flex-col items-center pt-6 space-y-4">
            <Avatar className="h-24 w-24">
              <AvatarImage src={profile.avatarUrl ?? undefined} alt={profile.name} />
              <AvatarFallback className="text-2xl">{getInitials(profile.name)}</AvatarFallback>
            </Avatar>
            <div className="text-center">
              <p className="text-lg font-semibold">{profile.name}</p>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {t('memberSince')} {formatDate(profile.createdAt)}
            </div>
          </CardContent>
        </Card>

        {/* Edit Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {t('personalInfo')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t('name')}</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t('email')}</Label>
                <Input id="email" value={profile.email} disabled className="opacity-60" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">{t('bio')}</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder={t('bioPlaceholder')}
                  maxLength={500}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground text-right">{bio.length}/500</p>
              </div>
            </CardContent>
          </Card>

          {/* Social Links */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                {t('socialLinks')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="website">{t('website')}</Label>
                <Input
                  id="website"
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder={t('websitePlaceholder')}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="twitter" className="flex items-center gap-1">
                    <Twitter className="h-4 w-4" />
                    {t('twitter')}
                  </Label>
                  <Input
                    id="twitter"
                    value={twitterHandle}
                    onChange={(e) => setTwitterHandle(e.target.value)}
                    placeholder={t('twitterPlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instagram" className="flex items-center gap-1">
                    <Instagram className="h-4 w-4" />
                    {t('instagram')}
                  </Label>
                  <Input
                    id="instagram"
                    value={instagramHandle}
                    onChange={(e) => setInstagramHandle(e.target.value)}
                    placeholder={t('instagramPlaceholder')}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? t('saving') : t('save')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create the page route**

Create `apps/web/src/app/[locale]/(collector)/profile/page.tsx`:

```tsx
'use client';

import { ProfilePage } from '@/components/features/profile/profile-page';

export default function ProfileRoute() {
  return <ProfilePage />;
}
```

- [ ] **Step 4: Test manually**

1. Navigate to `http://localhost:3000/pt-BR/profile`
2. Verify: avatar initials display, all fields populated from API
3. Edit name, bio, social links — click save
4. Verify: toast "Perfil atualizado com sucesso" appears
5. Refresh page — verify changes persisted
6. Test validation: empty name should disable save button
7. Test: click profile link in header dropdown — navigates correctly

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/api/users.ts \
       apps/web/src/app/\[locale\]/\(collector\)/profile/page.tsx \
       apps/web/src/components/features/profile/profile-page.tsx \
       apps/web/src/messages/pt-BR.json
git commit -m "feat: add profile page with view and edit form"
```

---

## Task 4: Settings Page (Hub)

Simple hub page linking to existing settings-related pages. No new API calls needed.

**Files:**
- Create: `apps/web/src/app/[locale]/(collector)/settings/page.tsx`
- Create: `apps/web/src/components/features/settings/settings-page.tsx`
- Modify: `apps/web/src/messages/pt-BR.json` (add `settings` namespace)

### Steps

- [ ] **Step 1: Add settings translations**

In `apps/web/src/messages/pt-BR.json`, add a new `"settings"` top-level key:

```json
"settings": {
  "title": "Configuracoes",
  "subtitle": "Gerencie sua conta e preferencias",
  "profile": "Perfil",
  "profileDescription": "Nome, bio e redes sociais",
  "notifications": "Notificacoes",
  "notificationsDescription": "Preferencias de e-mail e alertas",
  "subscription": "Assinatura",
  "subscriptionDescription": "Seu plano e forma de pagamento",
  "privacy": "Privacidade e Dados",
  "privacyDescription": "LGPD, exportacao e exclusao de dados",
  "addresses": "Enderecos",
  "addressesDescription": "Enderecos de entrega salvos"
}
```

- [ ] **Step 2: Create the settings page component**

Create `apps/web/src/components/features/settings/settings-page.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { User, Bell, Crown, Shield, MapPin, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';

interface SettingsLink {
  titleKey: string;
  descriptionKey: string;
  href: string;
  icon: LucideIcon;
}

const SETTINGS_LINKS: SettingsLink[] = [
  { titleKey: 'profile', descriptionKey: 'profileDescription', href: '/profile', icon: User },
  { titleKey: 'notifications', descriptionKey: 'notificationsDescription', href: '/notifications/preferences', icon: Bell },
  { titleKey: 'subscription', descriptionKey: 'subscriptionDescription', href: '/subscription', icon: Crown },
  { titleKey: 'privacy', descriptionKey: 'privacyDescription', href: '/lgpd', icon: Shield },
  { titleKey: 'addresses', descriptionKey: 'addressesDescription', href: '/addresses', icon: MapPin },
];

export function SettingsPage() {
  const t = useTranslations('settings');
  const locale = useLocale();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {SETTINGS_LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <Link key={link.href} href={`/${locale}${link.href}`}>
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{t(link.titleKey)}</p>
                    <p className="text-sm text-muted-foreground">{t(link.descriptionKey)}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create the page route**

Create `apps/web/src/app/[locale]/(collector)/settings/page.tsx`:

```tsx
'use client';

import { SettingsPage } from '@/components/features/settings/settings-page';

export default function SettingsRoute() {
  return <SettingsPage />;
}
```

- [ ] **Step 4: Test manually**

1. Navigate to `http://localhost:3000/pt-BR/settings`
2. Verify: all 5 cards render with correct icons and text
3. Click each card — verify it navigates to the correct page
4. Test: click "Configuracoes" in header dropdown — navigates correctly
5. Test mobile: cards should stack in single column

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\[locale\]/\(collector\)/settings/page.tsx \
       apps/web/src/components/features/settings/settings-page.tsx \
       apps/web/src/messages/pt-BR.json
git commit -m "feat: add settings hub page linking to account configuration"
```

---

## Task 5: Final Cleanup & Verification

- [ ] **Step 1: Verify no remaining 404 references**

Search for any other href/push references to routes that don't have pages:

```bash
# In the project root, grep for route patterns and cross-check
grep -rn "href=.*/${locale}/" apps/web/src/components/ | grep -v node_modules
```

- [ ] **Step 2: Verify protectedRoutes includes /settings**

Open `apps/web/src/components/layout/nav-config.ts` and add `/settings` to the `protectedRoutes` array if missing:

```ts
export const protectedRoutes = [
  '/collection',
  '/collection/series-progress',
  '/favorites',
  '/cart',
  '/orders',
  '/payments/history',
  '/seller/banking',
  '/profile',
  '/settings',  // ADD THIS
  '/subscription',
  '/notifications',
  '/notifications/preferences',
  '/lgpd',
  '/admin',
];
```

- [ ] **Step 3: Run type-check**

```bash
pnpm type-check
```

Expected: no errors in the new files.

- [ ] **Step 4: Test all 3 pages in browser**

Full walkthrough:
1. `/pt-BR/cart` — empty state + with items
2. `/pt-BR/profile` — load, edit, save
3. `/pt-BR/settings` — all links work
4. Header dropdown: "Perfil" and "Configuracoes" links work
5. Sidebar nav: "Carrinho" and "Perfil" links work
6. Open DevTools console on admin/legal — no more RangeError, no 404s for cart/profile

- [ ] **Step 5: Commit cleanup**

```bash
git add apps/web/src/components/layout/nav-config.ts
git commit -m "chore: add /settings to protected routes"
```
