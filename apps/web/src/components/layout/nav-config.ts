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
  Bell,
  LayoutDashboard,
  Library,
  Users,
  FileText,
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
  adminOnly?: boolean;
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
    items: [
      { titleKey: 'nav.collection', href: '/collection', icon: BookOpen },
      { titleKey: 'nav.seriesProgress', href: '/series-progress', icon: BarChart3 },
      { titleKey: 'nav.favorites', href: '/favorites', icon: Heart },
    ],
  },
  {
    labelKey: 'nav.groups.orders',
    items: [
      { titleKey: 'nav.cart', href: '/cart', icon: ShoppingCart },
      { titleKey: 'nav.myOrders', href: '/orders', icon: Package },
    ],
  },
  {
    labelKey: 'nav.groups.account',
    items: [
      { titleKey: 'nav.profile', href: '/profile', icon: User },
      { titleKey: 'nav.settings', href: '/settings', icon: Settings },
      { titleKey: 'nav.notifications', href: '/notifications', icon: Bell },
    ],
  },
  {
    labelKey: 'nav.groups.admin',
    adminOnly: true,
    items: [
      { titleKey: 'nav.adminDashboard', href: '/admin', icon: LayoutDashboard },
      { titleKey: 'nav.adminCatalog', href: '/admin/catalog', icon: Library },
      { titleKey: 'nav.adminUsers', href: '/admin/users', icon: Users },
      { titleKey: 'nav.adminContent', href: '/admin/content', icon: FileText },
    ],
  },
];
