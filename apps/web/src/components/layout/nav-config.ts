import {
  Home,
  Library,
  Store,
  Tag,
  BookOpen,
  BarChart3,
  Heart,
  ShoppingCart,
  Package,
  User,
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
  Scale,
  Shield,
  MessageSquare,
  FileCheck,
  Mail,
  Clock,
  ListPlus,
  ImageIcon,
  Copy,
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
      { titleKey: 'nav.catalog', href: '/catalog', icon: Library },
      { titleKey: 'nav.marketplace', href: '/marketplace', icon: Store },
      { titleKey: 'nav.deals', href: '/deals', icon: Tag },
      { titleKey: 'nav.contact', href: '/contact', icon: MessageSquare },
    ],
  },
  {
    labelKey: 'nav.groups.collection',
    requiresAuth: true,
    items: [
      { titleKey: 'nav.collection', href: '/collection', icon: BookOpen },
      { titleKey: 'nav.timeline', href: '/collection/timeline', icon: Clock },
      { titleKey: 'nav.batchAdd', href: '/collection/add-batch', icon: ListPlus },
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
      { titleKey: 'nav.lgpd', href: '/lgpd', icon: Shield },
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
      { titleKey: 'nav.adminRecentCatalog', href: '/admin/catalog/recent', icon: Clock },
      { titleKey: 'nav.adminCovers', href: '/admin/covers', icon: ImageIcon },
      { titleKey: 'nav.adminCoverSubmissions', href: '/admin/cover-submissions', icon: ImageIcon },
      { titleKey: 'nav.adminDuplicates', href: '/admin/duplicates', icon: Copy },
      { titleKey: 'nav.adminUsers', href: '/admin/users', icon: Users },
      { titleKey: 'nav.adminContent', href: '/admin/content', icon: FileText },
      { titleKey: 'nav.adminPayments', href: '/admin/payments', icon: CreditCard },
      { titleKey: 'nav.adminCommission', href: '/admin/commission', icon: PieChart },
      { titleKey: 'nav.adminBanking', href: '/admin/banking', icon: Landmark },
      { titleKey: 'nav.adminDisputes', href: '/admin/disputes', icon: Scale },
      { titleKey: 'nav.adminSubscriptions', href: '/admin/subscriptions', icon: Crown },
      { titleKey: 'nav.adminPlans', href: '/admin/subscriptions/plans', icon: Layers },
      { titleKey: 'nav.adminDeals', href: '/admin/deals', icon: Tag },
      { titleKey: 'nav.adminHomepage', href: '/admin/homepage', icon: Home },
      { titleKey: 'nav.adminLegal', href: '/admin/legal', icon: FileCheck },
      { titleKey: 'nav.adminLgpd', href: '/admin/lgpd', icon: Shield },
      { titleKey: 'nav.adminContact', href: '/admin/contact', icon: Mail },
    ],
  },
];

/**
 * Routes that require authentication.
 * Used by middleware and client-side redirect logic.
 */
export const protectedRoutes = [
  '/collection',
  '/collection/add-batch',
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
  '/lgpd',
  '/admin',
];
