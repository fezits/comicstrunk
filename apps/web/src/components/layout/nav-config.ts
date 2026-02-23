import {
  Home,
  Store,
  Tag,
  BookOpen,
  BarChart3,
  Heart,
  ShoppingCart,
  Package,
  User,
  Settings,
  LayoutDashboard,
  Library,
  Users,
  FileText,
  FolderOpen,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = {
  titleKey: string;
  href: string;
  icon: LucideIcon;
};

export type NavGroup = {
  labelKey: string;
  items: NavItem[];
  /** Only visible to admin users */
  adminOnly?: boolean;
  /** Requires authentication to be visible */
  requiresAuth?: boolean;
};

export const navGroups: NavGroup[] = [
  {
    labelKey: 'nav.groups.public',
    items: [
      { titleKey: 'nav.home', href: '/', icon: Home },
      { titleKey: 'nav.marketplace', href: '/marketplace', icon: Store },
      { titleKey: 'nav.deals', href: '/deals', icon: Tag },
    ],
  },
  {
    labelKey: 'nav.groups.collection',
    requiresAuth: true,
    items: [
      { titleKey: 'nav.collection', href: '/collection', icon: BookOpen },
      { titleKey: 'nav.seriesProgress', href: '/series-progress', icon: BarChart3 },
      { titleKey: 'nav.favorites', href: '/favorites', icon: Heart },
    ],
  },
  {
    labelKey: 'nav.groups.orders',
    requiresAuth: true,
    items: [
      { titleKey: 'nav.cart', href: '/cart', icon: ShoppingCart },
      { titleKey: 'nav.myOrders', href: '/orders', icon: Package },
    ],
  },
  {
    labelKey: 'nav.groups.account',
    requiresAuth: true,
    items: [
      { titleKey: 'nav.profile', href: '/profile', icon: User },
      { titleKey: 'nav.settings', href: '/settings', icon: Settings },
    ],
  },
  {
    labelKey: 'nav.groups.admin',
    adminOnly: true,
    requiresAuth: true,
    items: [
      { titleKey: 'nav.adminDashboard', href: '/admin', icon: LayoutDashboard },
      { titleKey: 'nav.adminCatalog', href: '/admin/catalog', icon: Library },
      { titleKey: 'nav.adminUsers', href: '/admin/users', icon: Users },
      { titleKey: 'nav.adminContent', href: '/admin/content', icon: FileText },
      { titleKey: 'nav.adminCategories', href: '/admin/content/categories', icon: FolderOpen },
      { titleKey: 'nav.adminSeries', href: '/admin/content/series', icon: BookOpen },
      { titleKey: 'nav.adminTags', href: '/admin/content/tags', icon: Tag },
      { titleKey: 'nav.adminCharacters', href: '/admin/content/characters', icon: Users },
    ],
  },
];

/**
 * Routes that require authentication.
 * Used by middleware and client-side redirect logic.
 */
export const protectedRoutes = [
  '/collection',
  '/series-progress',
  '/favorites',
  '/cart',
  '/orders',
  '/profile',
  '/settings',
  '/notifications',
  '/admin',
];
