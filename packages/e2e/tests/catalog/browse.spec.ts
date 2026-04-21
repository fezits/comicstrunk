import { test, expect } from '../../fixtures';
import { CatalogPage } from '../../page-objects/catalog.page';

test.describe('Catalog Browsing', () => {
  let catalog: CatalogPage;

  test.beforeEach(async ({ page }) => {
    catalog = new CatalogPage(page);
    await catalog.navigate();
    await catalog.waitForResults();
  });

  test('should display catalog page with heading and seed data', async () => {
    await expect(catalog.heading).toContainText(/cat[aá]logo/i);
    await expect(catalog.comicCount).toBeVisible();

    // Seed data has 10 approved entries
    const count = await catalog.getTotalCount();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('should show comic count matching seed data', async () => {
    // The seed creates 10 approved catalog entries
    const count = await catalog.getTotalCount();
    expect(count).toBeGreaterThanOrEqual(10);
  });

  test('should display search input and toolbar controls', async () => {
    await expect(catalog.searchInput).toBeVisible();
    await expect(catalog.gridButton).toBeVisible();
    await expect(catalog.listButton).toBeVisible();
    await expect(catalog.sortButton).toBeVisible();
    await expect(catalog.filtersButton).toBeVisible();
  });

  test('should search by title and filter results', async ({ page }) => {
    // Get the first card title to use as a search term
    const titles = await catalog.getCardTitles();
    expect(titles.length).toBeGreaterThan(0);

    // Use first few characters of the first title as search term
    const searchTerm = titles[0].substring(0, 5);
    await catalog.search(searchTerm);

    // Should either show filtered results or no results
    const cardCount = await catalog.getCardCount();
    if (cardCount > 0) {
      // Verify at least one result contains the search term (case-insensitive)
      const filteredTitles = await catalog.getCardTitles();
      const hasMatch = filteredTitles.some((t) =>
        t.toLowerCase().includes(searchTerm.toLowerCase()),
      );
      expect(hasMatch).toBeTruthy();
    }
  });

  test('search with no match shows empty state', async () => {
    await catalog.search('xyznonexistent12345zzz');
    await catalog.expectNoResults();
  });

  test('should toggle between grid and list view', async ({ page }) => {
    // Default view should be grid - verify cards are visible
    await catalog.expectHasResults();

    // Switch to list view
    await catalog.switchToList();
    // The list button should now have the "default" variant (active state)
    await expect(catalog.listButton).toBeVisible();
    // Verify items are still displayed (list uses same .grid .block.group pattern)
    const listCount = await catalog.getListItemCount();
    expect(listCount).toBeGreaterThan(0);

    // Switch back to grid view
    await catalog.switchToGrid();
    await expect(catalog.gridButton).toBeVisible();
    const gridCount = await catalog.getCardCount();
    expect(gridCount).toBeGreaterThan(0);
  });

  test('should open sort dropdown and sort by title', async ({ page }) => {
    // Get titles in default order (sorted by date desc)
    const titlesBefore = await catalog.getCardTitles();
    expect(titlesBefore.length).toBeGreaterThan(1);

    // Sort by title
    await catalog.selectSort('Titulo');

    // Get titles after sorting
    const titlesAfter = await catalog.getCardTitles();
    expect(titlesAfter.length).toBeGreaterThan(0);

    // The order should be different from the original (date-based) order
    // or at least the sort was applied (titles are now in ascending alphabetical order)
    const sorted = [...titlesAfter].sort((a, b) =>
      a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }),
    );
    expect(titlesAfter).toEqual(sorted);
  });

  test('should open and close filter panel', async ({ page }) => {
    // Click "Filtros" to open
    await catalog.toggleFilters();

    // The filter panel should become visible (look for filter-specific content)
    // After opening, button text changes to "Ocultar filtros"
    await expect(
      page.getByRole('button', { name: /ocultar filtros/i }),
    ).toBeVisible();

    // Filter panel should show filter sections like "Categorias", "Personagens"
    await expect(page.getByText(/categorias/i).first()).toBeVisible();

    // Click again to close
    await catalog.toggleFilters();

    // The button should revert to "Filtros"
    await expect(
      page.getByRole('button', { name: /^filtros$/i }).first(),
    ).toBeVisible();
  });

  test('should clear filters after searching', async () => {
    // Apply a search filter
    await catalog.search('xyznonexistent12345zzz');
    await catalog.expectNoResults();

    // Clear filters using the button shown on no-results state
    await catalog.clearFilters();

    // Results should reappear
    await catalog.expectHasResults();
  });

  test('should not show pagination with 10 seed entries (limit is 20)', async () => {
    // With only 10 entries and a page limit of 20, there should be no pagination
    const count = await catalog.getTotalCount();
    if (count <= 20) {
      await expect(catalog.prevPageButton).not.toBeVisible();
      await expect(catalog.nextPageButton).not.toBeVisible();
    }
  });

  test('should update URL search params when filtering', async ({ page }) => {
    // Search for something
    await catalog.search('test');

    // URL should contain the title param
    const url = page.url();
    expect(url).toContain('title=test');

    // Clear the search
    await catalog.searchInput.fill('');
    await page.waitForTimeout(600);
    await catalog.waitForResults();

    // URL should no longer have the title param
    const cleanUrl = page.url();
    expect(cleanUrl).not.toContain('title=test');
  });
});
