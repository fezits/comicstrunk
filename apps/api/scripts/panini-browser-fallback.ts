/**
 * panini-browser-fallback.ts — Browser-based scraper for Panini when GraphQL API is down.
 * Uses Playwright to navigate the Panini website and extract product data.
 * 
 * Usage: npx tsx scripts/panini-browser-fallback.ts [--dry-run] [--category marvel|dc|panini-comics|planet-manga]
 */
import { chromium, type Page, type Browser } from 'playwright';

const DRY_RUN = process.argv.includes('--dry-run');
const CATEGORY_ARG = process.argv.find(a => a.startsWith('--category='))?.split('=')[1];

interface PaniniProduct {
  sourceKey: string;
  title: string;
  publisher: string;
  coverPrice: number | null;
  categories: string[];
  imageUrl: string | null;
  sku: string;
}

const PANINI_CATEGORIES: { slug: string; name: string; url: string }[] = [
  { slug: 'marvel', name: 'Marvel', url: 'https://panini.com.br/marvel' },
  { slug: 'dc', name: 'DC', url: 'https://panini.com.br/dc' },
  { slug: 'panini-comics', name: 'Panini Comics', url: 'https://panini.com.br/panini-comics' },
  { slug: 'planet-manga', name: 'Planet Mangá', url: 'https://panini.com.br/planet-manga' },
];

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function extractProducts(page: Page): Promise<PaniniProduct[]> {
  return page.evaluate(() => {
    const products: any[] = [];
    const items = document.querySelectorAll('.product-item, .product-items .product-item, li.product-item');
    
    items.forEach(item => {
      try {
        const nameEl = item.querySelector('.product-item-name a, .product-item-link, .product.name a');
        const priceEl = item.querySelector('.price, .price-wrapper [data-price-amount], span.price');
        const imgEl = item.querySelector('.product-image-photo, img.product-image-photo') as HTMLImageElement;
        const linkEl = item.querySelector('a.product-item-link, .product-item-name a, a[href*="/"]') as HTMLAnchorElement;
        
        const title = nameEl?.textContent?.trim() || '';
        if (!title) return;
        
        // Extract SKU from URL or data attribute
        const href = linkEl?.href || '';
        const skuMatch = href.match(/\/([^/]+?)(?:\.html)?$/);
        const sku = item.getAttribute('data-product-sku') || 
                    (item.querySelector('[data-product-sku]') as HTMLElement)?.getAttribute('data-product-sku') ||
                    skuMatch?.[1] || '';
        
        // Extract price
        let price: number | null = null;
        const priceAmount = item.querySelector('[data-price-amount]')?.getAttribute('data-price-amount');
        if (priceAmount) {
          price = parseFloat(priceAmount);
        } else if (priceEl) {
          const priceText = priceEl.textContent?.replace(/[^\d,]/g, '').replace(',', '.');
          if (priceText) price = parseFloat(priceText);
        }
        
        // Extract image
        let imageUrl = imgEl?.src || imgEl?.getAttribute('data-src') || null;
        if (imageUrl?.includes('placeholder')) imageUrl = null;
        
        products.push({ title, sku, price, imageUrl });
      } catch { /* skip item */ }
    });
    
    return products;
  }).then(raw => raw.map(p => ({
    sourceKey: `panini:${p.sku}`,
    title: p.title,
    publisher: 'Panini',
    coverPrice: p.price && p.price > 0 ? p.price : null,
    categories: [],  // filled by caller
    imageUrl: p.imageUrl,
    sku: p.sku,
  })));
}

async function getPageCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const pages = document.querySelectorAll('.pages .page a, .pages-items .page a, ul.pages-items li a');
    let max = 1;
    pages.forEach(p => {
      const num = parseInt(p.textContent?.trim() || '0');
      if (num > max) max = num;
    });
    return max;
  });
}

async function scrapCategory(browser: Browser, cat: typeof PANINI_CATEGORIES[0]): Promise<PaniniProduct[]> {
  console.log(`\n📂 ${cat.name} (${cat.url})`);
  const page = await browser.newPage();
  const allProducts: PaniniProduct[] = [];
  
  try {
    // First page
    await page.goto(`${cat.url}?product_list_limit=36`, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000);
    
    const totalPages = await getPageCount(page);
    console.log(`  Total pages: ${totalPages}`);
    
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      if (pageNum > 1) {
        await page.goto(`${cat.url}?product_list_limit=36&p=${pageNum}`, { waitUntil: 'networkidle', timeout: 30000 });
        await sleep(2000);
      }
      
      const products = await extractProducts(page);
      products.forEach(p => {
        p.categories = [cat.name];
      });
      
      allProducts.push(...products);
      console.log(`  Page ${pageNum}/${totalPages}: ${products.length} products (total: ${allProducts.length})`);
      
      if (products.length === 0) {
        console.log('  ⚠️ No products found — page structure may have changed');
        break;
      }
    }
  } catch (e: any) {
    console.error(`  Error: ${e.message}`);
  } finally {
    await page.close();
  }
  
  return allProducts;
}

async function main() {
  console.log('=== Panini Browser Fallback Scraper ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Time: ${new Date().toISOString()}\n`);
  
  const browser = await chromium.launch({ headless: true });
  
  const categoriesToScrape = CATEGORY_ARG 
    ? PANINI_CATEGORIES.filter(c => c.slug === CATEGORY_ARG)
    : PANINI_CATEGORIES;
  
  if (categoriesToScrape.length === 0) {
    console.error('Invalid category. Use: marvel, dc, panini-comics, planet-manga');
    await browser.close();
    return;
  }
  
  const allProducts: PaniniProduct[] = [];
  
  for (const cat of categoriesToScrape) {
    const products = await scrapCategory(browser, cat);
    allProducts.push(...products);
  }
  
  await browser.close();
  
  // Dedup by SKU
  const seen = new Set<string>();
  const unique = allProducts.filter(p => {
    if (!p.sku || seen.has(p.sku)) return false;
    seen.add(p.sku);
    return true;
  });
  
  console.log(`\n========================================`);
  console.log(`  Total unique products: ${unique.length}`);
  console.log(`  Duplicates removed: ${allProducts.length - unique.length}`);
  console.log(`  With price: ${unique.filter(p => p.coverPrice).length}`);
  console.log(`  With image: ${unique.filter(p => p.imageUrl).length}`);
  console.log(`========================================`);
  
  // Output as JSON for sync-catalog-remote.ts to consume
  const outPath = new URL('./panini-browser-data.json', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
  if (!DRY_RUN) {
    const fs = await import('fs');
    fs.writeFileSync(outPath, JSON.stringify(unique, null, 2));
    console.log(`\nSaved to ${outPath}`);
  }
  
  // Show sample
  console.log('\nSample (first 5):');
  unique.slice(0, 5).forEach(p => {
    console.log(`  ${p.sourceKey} | ${p.title.substring(0, 50)} | R$${p.coverPrice || '?'}`);
  });
}

export { PaniniProduct, scrapCategory, PANINI_CATEGORIES };

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
