const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  
  await page.goto('http://localhost:3006/pt-BR/login');
  await page.waitForTimeout(2000);
  
  // Fill login
  const emailInput = page.locator('input[name="email"], input[type="email"]').first();
  const passInput = page.locator('input[name="password"], input[type="password"]').first();
  
  if (await emailInput.count() > 0) {
    await emailInput.fill('admin@comicstrunk.com');
    await passInput.fill('Admin123!');
    await page.screenshot({ path: 'screenshot-login.png' });
    
    const submitBtn = page.locator('button[type="submit"]').first();
    await submitBtn.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshot-after-login.png' });
    console.log('URL after login:', page.url());
  } else {
    console.log('No email input found');
    await page.screenshot({ path: 'screenshot-page.png' });
  }

  // Navigate to catalog/explore
  const urls = ['/pt-BR/catalog', '/pt-BR/explore', '/pt-BR/admin', '/pt-BR'];
  for (const url of urls) {
    try {
      await page.goto('http://localhost:3006' + url, { timeout: 5000 });
      await page.waitForTimeout(2000);
      const name = url.replace(/\//g, '-').replace(/^-/, '') || 'home';
      await page.screenshot({ path: 'screenshot-' + name + '.png' });
      console.log(url + ' → ' + page.url());
    } catch(e) {
      console.log(url + ' failed: ' + e.message);
    }
  }

  await browser.close();
  console.log('Done');
})();
