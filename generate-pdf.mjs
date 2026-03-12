import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = `file://${path.resolve(__dirname, 'index.html')}`;

const browser = await chromium.launch({
  executablePath: '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 720 });
await page.goto(filePath, { waitUntil: 'load', timeout: 60000 });

// Wait for fonts to load
await page.waitForTimeout(2000);

// Get total slide count
const total = await page.evaluate(() => document.querySelectorAll('.slide').length);

const slides = [];

for (let i = 0; i < total; i++) {
  // Navigate to slide
  await page.evaluate((idx) => {
    const slides = document.querySelectorAll('.slide');
    slides.forEach((s, j) => {
      s.classList.remove('active', 'prev');
      if (j === idx) s.classList.add('active');
      else if (j < idx) s.classList.add('prev');
    });
    // Hide nav and counter
    document.querySelector('.nav').style.display = 'none';
    document.querySelector('.counter').style.display = 'none';
    document.querySelector('.progress').style.display = 'none';
  }, i);

  await page.waitForTimeout(300);

  const screenshot = await page.screenshot({ type: 'png' });
  slides.push(screenshot);
}

// Generate PDF with all slides as pages
await page.evaluate(() => {
  document.body.innerHTML = '';
  document.body.style.margin = '0';
  document.body.style.padding = '0';
  document.body.style.background = 'white';
});

// Use PDF generation approach - create a page per slide
const pdfPage = await browser.newPage();
await pdfPage.setViewportSize({ width: 1280, height: 720 });

// Build HTML with all slides as images
const imgTags = slides.map((buf, i) => {
  const b64 = buf.toString('base64');
  return `<div style="width:1280px;height:720px;page-break-after:always;margin:0;padding:0;"><img src="data:image/png;base64,${b64}" style="width:1280px;height:720px;display:block;"/></div>`;
}).join('');

const html = `<!DOCTYPE html><html><head><style>@page{size:1280px 720px;margin:0;}body{margin:0;padding:0;}</style></head><body>${imgTags}</body></html>`;

await pdfPage.setContent(html, { waitUntil: 'networkidle' });
await pdfPage.waitForTimeout(1000);

await pdfPage.pdf({
  path: path.resolve(__dirname, 'slides.pdf'),
  width: '1280px',
  height: '720px',
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
  printBackground: true,
  preferCSSPageSize: true,
});

await browser.close();
console.log(`PDF generated: slides.pdf (${total} slides)`);
