#!/usr/bin/env node
/**
 * Explore Amazon BR HQs category and extract product listings
 * Outputs JSON with title, author, publisher, price, image, ASIN
 */

const path = require('path');
const fs = require('fs');
const PNPM = path.join(__dirname, '..', 'node_modules', '.pnpm');
const pw = require(path.join(PNPM, 'playwright-core@1.58.2', 'node_modules', 'playwright-core'));

const BASE_URL = 'https://www.amazon.com.br/s?i=stripbooks&rh=n%3A13986363011&s=popularity-rank&fs=true';
const MAX_PAGES = parseInt(process.argv[2]) || 5;

async function extractProducts(page) {
  return page.evaluate(() => {
    const items = [];
    const cards = document.querySelectorAll('[data-component-type="s-search-result"]');
    for (const card of cards) {
      const titleEl = card.querySelector('h2 a span');
      const linkEl = card.querySelector('h2 a');
      const imgEl = card.querySelector('img.s-image');
      const priceWhole = card.querySelector('.a-price-whole');
      const priceFraction = card.querySelector('.a-price-fraction');
      const authorEl = card.querySelector('.a-row .a-size-base:not(.a-link-normal)');

      // Extract ASIN from data attribute or link
      const asin = card.dataset.asin || '';

      // Extract author/publisher from the lines below title
      const metaRows = card.querySelectorAll('.a-row.a-size-base');
      let author = '';
      let format = '';
      for (const row of metaRows) {
        const text = row.textContent.trim();
        if (text.includes('por ')) {
          author = text.replace('por ', '').trim();
        }
        if (text.includes('Capa') || text.includes('eBook') || text.includes('Kindle')) {
          format = text.trim();
        }
      }

      if (titleEl) {
        const price = priceWhole ?
          parseFloat(`${priceWhole.textContent.replace(',', '.')}.${priceFraction?.textContent || '00'}`) : null;

        items.push({
          title: titleEl.textContent.trim(),
          asin,
          author,
          format,
          price,
          image: imgEl?.src || null,
          link: linkEl?.href || null,
        });
      }
    }
    return items;
  });
}

async function getResultCount(page) {
  return page.evaluate(() => {
    const countEl = document.querySelector('.s-breadcrumb .a-text-bold, [data-component-type="s-result-info-bar"] span');
    return countEl?.textContent?.trim() || 'unknown';
  });
}

async function run() {
  const browser = await pw.chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'pt-BR',
  });

  const allProducts = [];
  const page = await context.newPage();

  for (let p = 1; p <= MAX_PAGES; p++) {
    const url = p === 1 ? BASE_URL : `${BASE_URL}&page=${p}`;
    console.error(`Page ${p}/${MAX_PAGES}...`);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(3000);

      if (p === 1) {
        const count = await getResultCount(page);
        console.error(`Total results: ${count}`);
      }

      const products = await extractProducts(page);
      console.error(`  Found ${products.length} products`);
      allProducts.push(...products);

      // Rate limit
      if (p < MAX_PAGES) {
        await page.waitForTimeout(2000 + Math.random() * 2000);
      }
    } catch (err) {
      console.error(`  Error on page ${p}: ${err.message}`);
    }
  }

  await browser.close();

  // Output results
  console.log(JSON.stringify(allProducts, null, 2));
  console.error(`\nTotal: ${allProducts.length} products from ${MAX_PAGES} pages`);
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
