const { chromium } = require('C:/Projetos/connect/connect_front/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('requestfailed', r => consoleErrors.push('NETWORK: ' + r.url() + ' ' + r.failure().errorText));
  page.on('response', r => { if (r.status() >= 400) consoleErrors.push('HTTP ' + r.status() + ': ' + r.url()); });
  
  // Login
  await page.goto('http://localhost:3006/pt-BR/login');
  await page.waitForTimeout(1500);
  await page.locator('input[type=email]').first().fill('admin@comicstrunk.com');
  await page.locator('input[type=password]').first().fill('Admin123!');
  await page.locator('button[type=submit]').first().click();
  await page.waitForTimeout(3000);
  
  // Go to catalog
  await page.goto('http://localhost:3006/pt-BR/catalog', { timeout: 15000, waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  // Find catalog entry links
  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a')).map(a => ({ href: a.href, text: (a.textContent || '').slice(0,60) })).filter(l => l.href.includes('/catalog/'));
  });
  console.log('Found catalog links:', links.length);
  links.slice(0, 3).forEach(l => console.log('  Link:', l.href, '-', l.text));
  
  if (links.length > 0) {
    // Navigate directly to first detail page
    await page.goto(links[0].href, { timeout: 15000 });
    await page.waitForTimeout(4000);
  } else {
    // Try clicking first card
    console.log('No /catalog/ links, clicking first card...');
    const card = page.locator('[class*="card"]').first();
    await card.click();
    await page.waitForTimeout(4000);
  }
  
  console.log('Detail URL:', page.url());
  await page.screenshot({ path: 'C:/Users/NOETCOMP-1448/.openclaw/workspace/ss-detail-broken.png' });
  
  consoleErrors.forEach(e => console.log('ERROR:', e));
  
  await browser.close();
  console.log('Done');
})();
