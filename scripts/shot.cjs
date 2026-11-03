// 사용법: node shot.cjs <url> <out.png> [width] [height] [waitMs]
const { chromium } = require('playwright');
(async () => {
  const [,, url, out, w = '360', h = '780', wait = '800'] = process.argv;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.waitForTimeout(+wait);
  await p.screenshot({ path: out });
  console.log('errors:', JSON.stringify(errs.slice(0, 5)));
  await b.close();
})();
