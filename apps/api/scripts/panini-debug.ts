import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://panini.com.br/marvel?product_list_limit=36', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  await page.screenshot({ path: 'panini-marvel.png', fullPage: false });
  console.log('Screenshot saved');

  const structure = await page.evaluate(() => {
    const selectors = [
      '.product-item', '.product-items', '.products-grid', 
      '.product.photo', '[data-product-sku]', '.category-products',
      '.column.main', '.products.wrapper', '.products.list',
      'ol.products', 'ul.products', '.product-item-info',
    ];
    const found: Record<string,number> = {};
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) found[sel] = els.length;
    }
    
    // Find first product-like element
    const firstProduct = document.querySelector('.product-item-info') || document.querySelector('.product-item');
    const firstHtml = firstProduct?.outerHTML?.substring(0, 1000) || 'NOT FOUND';
    
    // Pagination
    const pages = document.querySelectorAll('.pages-items li a, .pages li a');
    let maxPage = 1;
    pages.forEach(p => {
      const num = parseInt(p.textContent?.trim() || '0');
      if (num > maxPage) maxPage = num;
    });
    
    return { selectors: found, firstProductHtml: firstHtml, maxPage };
  });

  console.log('Found selectors:', JSON.stringify(structure.selectors, null, 2));
  console.log('Max page:', structure.maxPage);
  console.log('\nFirst product HTML:\n', structure.firstProductHtml);

  await browser.close();
}

main().catch(console.error);
