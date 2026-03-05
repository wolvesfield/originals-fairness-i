import { chromium } from 'playwright';

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    page.on('console', msg => console.log('BROWSER_CONSOLE:', msg.text()));
    page.on('pageerror', error => console.error('BROWSER_PAGE_ERROR:', error));

    try {
        const response = await page.goto('http://localhost:5000', { waitUntil: 'load' });
        console.log('Status code:', response.status());

        // Wait a brief moment for React to mount
        await page.waitForTimeout(1000);

        const rootHtml = await page.evaluate(() => document.getElementById('root')?.innerHTML || '');
        console.log('Root innerHTML length:', rootHtml.length);
        if (rootHtml.length > 0) {
            console.log('App successfully mounted!');
        } else {
            console.log('App is still blank.');
        }
    } catch (err) {
        console.error('Playwright Error:', err);
    } finally {
        await browser.close();
    }
})();
