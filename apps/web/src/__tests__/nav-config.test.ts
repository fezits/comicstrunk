import { describe, it, expect } from 'vitest';
import { navGroups, protectedRoutes } from '@/components/layout/nav-config';

describe('nav-config', () => {
  describe('navGroups', () => {
    it('should have "Início" pointing to /catalog', () => {
      const publicGroup = navGroups.find((g) => g.labelKey === 'nav.groups.public');
      expect(publicGroup).toBeDefined();

      const homeItem = publicGroup!.items.find((i) => i.titleKey === 'nav.home');
      expect(homeItem).toBeDefined();
      expect(homeItem!.href).toBe('/catalog');
    });

    it('should have collection group requiring auth', () => {
      const collGroup = navGroups.find((g) => g.labelKey === 'nav.groups.collection');
      expect(collGroup).toBeDefined();
      expect(collGroup!.requiresAuth).toBe(true);
    });

    it('should have orders group requiring auth', () => {
      const ordersGroup = navGroups.find((g) => g.labelKey === 'nav.groups.orders');
      expect(ordersGroup).toBeDefined();
      expect(ordersGroup!.requiresAuth).toBe(true);
    });

    it('should have account group requiring auth', () => {
      const accountGroup = navGroups.find((g) => g.labelKey === 'nav.groups.account');
      expect(accountGroup).toBeDefined();
      expect(accountGroup!.requiresAuth).toBe(true);
    });

    it('should have admin group requiring auth and adminOnly', () => {
      const adminGroup = navGroups.find((g) => g.labelKey === 'nav.groups.admin');
      expect(adminGroup).toBeDefined();
      expect(adminGroup!.requiresAuth).toBe(true);
      expect(adminGroup!.adminOnly).toBe(true);
    });

    it('should NOT have admin sub-items (categories, series, tags, characters)', () => {
      const adminGroup = navGroups.find((g) => g.labelKey === 'nav.groups.admin');
      const hrefs = adminGroup!.items.map((i) => i.href);
      expect(hrefs).not.toContain('/admin/content/categories');
      expect(hrefs).not.toContain('/admin/content/series');
      expect(hrefs).not.toContain('/admin/content/tags');
      expect(hrefs).not.toContain('/admin/content/characters');
    });

    it('every nav item should have titleKey, href, and icon', () => {
      for (const group of navGroups) {
        for (const item of group.items) {
          expect(item.titleKey).toBeTruthy();
          expect(item.href).toBeTruthy();
          expect(item.icon).toBeTruthy();
        }
      }
    });

    it('public group should NOT require auth', () => {
      const publicGroup = navGroups.find((g) => g.labelKey === 'nav.groups.public');
      expect(publicGroup!.requiresAuth).toBeFalsy();
    });
  });

  describe('protectedRoutes', () => {
    it('should include collection routes', () => {
      expect(protectedRoutes).toContain('/collection');
      expect(protectedRoutes).toContain('/collection/series-progress');
    });

    it('should include user account routes', () => {
      expect(protectedRoutes).toContain('/profile');
      expect(protectedRoutes).toContain('/settings');
    });

    it('should include admin route', () => {
      expect(protectedRoutes).toContain('/admin');
    });

    it('should NOT include catalog (public route)', () => {
      expect(protectedRoutes).not.toContain('/catalog');
    });

    it('should NOT include root (public route)', () => {
      expect(protectedRoutes).not.toContain('/');
    });
  });
});
