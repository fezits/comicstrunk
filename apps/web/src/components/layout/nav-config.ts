import {
  Library,
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
  Users,
  FileText,
  Receipt,
  Landmark,
  CreditCard,
  PieChart,
  Crown,
  Layers,
  Bell,
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
      { titleKey: 'nav.home', href: '/catalog', icon: Library },
      { titleKey: 'nav.marketplace', href: '/marketplace', icon: Store },
      { titleKey: 'nav.deals', href: '/deals', icon: Tag },
    ],
  },
  {
    labelKey: 'nav.groups.collection',
    requiresAuth: true,
    items: [
      { titleKey: 'nav.collection', href: '/collection', icon: BookOpen },
      { titleKey: 'nav.seriesProgress', href: '/collection/series-progress', icon: BarChart3 },
      { titleKey: 'nav.favorites', href: '/favorites', icon: Heart },
    ],
  },
  {
    labelKey: 'nav.groups.orders',
    requiresAuth: true,
    items: [
      { titleKey: 'nav.cart', href: '/cart', icon: ShoppingCart },
      { titleKey: 'nav.myOrders', href: '/orders', icon: Package },
      { titleKey: 'nav.paymentHistory', href: '/payments/history', icon: Receipt },
    ],
  },
  {
    labelKey: 'nav.groups.account',
    requiresAuth: true,
    items: [
      { titleKey: 'nav.profile', href: '/profile', icon: User },
      { titleKey: 'nav.notifications', href: '/notifications', icon: Bell },
      { titleKey: 'nav.subscription', href: '/subscription', icon: Crown },
      { titleKey: 'nav.settings', href: '/settings', icon: Settings },
    ],
  },
  {
    labelKey: 'nav.groups.seller',
    requiresAuth: true,
    items: [
      { titleKey: 'nav.sellerBanking', href: '/seller/banking', icon: Landmark },
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
      { titleKey: 'nav.adminPayments', href: '/admin/payments', icon: CreditCard },
      { titleKey: 'nav.adminCommission', href: '/admin/commission', icon: PieChart },
      { titleKey: 'nav.adminBanking', href: '/admin/banking', icon: Landmark },
      { titleKey: 'nav.adminSubscriptions', href: '/admin/subscriptions', icon: Crown },
      { titleKey: 'nav.adminPlans', href: '/admin/subscriptions/plans', icon: Layers },
    ],
  },
];

/**
 * Routes that require authentication.
 * Used by middleware and client-side redirect logic.
 */
export const protectedRoutes = [
  '/collection',
  '/collection/series-progress',
  '/favorites',
  '/cart',
  '/orders',
  '/payments/history',
  '/seller/banking',
  '/profile',
  '/settings',
  '/subscription',
  '/notifications',
  '/notifications/preferences',
  '/admin',
];
