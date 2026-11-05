import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Render the editable SVG masters with the existing browser dependency.
const root = new URL('../public/', import.meta.url);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  async function render(source, size, destination) {
    const svg = (await readFile(new URL(`icons/${source}.svg`, root), 'utf8')).trim();
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<style>html,body{margin:0;width:100%;height:100%;overflow:hidden}svg{display:block;width:100%;height:100%}</style>${svg}`);
    const png = await page.screenshot({ omitBackground: true });
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
    if (destination) await writeFile(new URL(destination, root), png);
    return png;
  }
  for (const size of [192, 512, 1024]) {
    await render('icon', size, `icons/icon-${size}.png`);
  }
  await render('icon', 180, 'icons/apple-touch-icon.png');
  // The entire mark fits within the central 80% diameter safe circle.
  await render('icon', 512, 'icons/icon-maskable-512.png');
  await render('favicon', 32, 'icons/favicon-32.png');
  const sizes = [16, 32, 48];
  const images = [];
  for (const size of sizes) images.push(await render('favicon', size));
  const header = Buffer.alloc(6 + sizes.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  images.forEach((png, i) => {
    const entry = 6 + i * 16;
    header[entry] = header[entry + 1] = sizes[i];
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  const ico = Buffer.concat([header, ...images]);
  assert.equal(ico.length, offset);
  await writeFile(new URL('favicon.ico', root), ico);
  console.log('Generated and dimension-checked all PNG icons and 16/32/48px ICO.');
} finally {
  await browser.close();
}
