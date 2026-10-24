const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs/promises');
const { existsSync } = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
let server, browser, base;
const manifest = require('../posts/index.json');

before(async () => {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
  server = http.createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const file = path.resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
      if (!file.startsWith(root + path.sep)) throw new Error('Invalid path');
      const content = await fs.readFile(file);
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); res.end(content);
    } catch { res.writeHead(404); res.end('Not found'); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = 'http://127.0.0.1:' + server.address().port;
  const executablePath = process.env.CHROME_PATH || (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined);
  browser = await chromium.launch({ executablePath, headless: true });
});
after(async () => { await browser?.close(); await new Promise((resolve) => server?.close(resolve)); });

async function pageFor(route = '/') {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  // The blog must work when the optional remote avatar is unavailable.
  await page.route((url) => url.protocol === 'https:', (route) => route.abort());
  await page.goto(base + route);
  return page;
}

test('all published articles render offline, with bounded mobile layouts', async () => {
  const page = await pageFor();
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.waitForSelector('.note-card');
  assert.equal(await page.locator('.note-card').count(), manifest.length);
  await page.waitForSelector('#avatar-fallback:not([hidden])');
  for (const filename of manifest) {
    await page.goto(base + '/article.html?post=' + encodeURIComponent(filename));
    await page.waitForSelector('#article-body-section:not([hidden])');
    assert.ok(await page.locator('#article-content').textContent(), filename);
    assert.equal(await page.locator('#article-error').isVisible(), false, filename);
    const duplicateIds = await page.evaluate(() => {
      const ids = [...document.querySelectorAll('[id]')].map((element) => element.id);
      return ids.length - new Set(ids).size;
    });
    assert.equal(duplicateIds, 0, filename);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, filename + ' at ' + width);
    }
  }
  assert.deepEqual(errors, []);
  await page.close();
});

test('actual Nav2 formulas render; UART C code is highlighted and copied exactly', async () => {
  const page = await pageFor('/article.html?post=Nav2_fastlivo2.md');
  await page.waitForSelector('.katex');
  assert.equal(await page.locator('.katex-error').count(), 0);
  assert.ok(await page.locator('.katex').count() >= 6);
  assert.ok(await page.locator('#article-toc a').count() > 0);
  await page.goto(base + '/article.html?post=USART_ADC_DMA.md');
  await page.waitForSelector('.hljs-keyword');
  const expected = await page.locator('pre code').first().textContent();
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.locator('.copy-code').first().click();
  await page.waitForFunction(() => document.querySelector('.copy-code').textContent.includes('已复制'));
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), expected);
  await page.close();
});

test('Markdown handles math, code literals, duplicate headings, callouts, GFM and safe links together', async () => {
  const page = await pageFor('/article.html?post=Nav2_fastlivo2.md');
  await page.waitForSelector('#article-content h2');
  const fixture = [
    '# Fixture', '## 重复标题', '## 重复标题',
    'Inline $x_i^2 + \\theta$ and \\(a < b\\).',
    '$$', '\\begin{bmatrix}1 & 2 \\\\ 3 & 4\\end{bmatrix}', '$$',
    '\\[', '\\sum_{i=1}^n x_i', '\\]',
    '```bash', 'echo $USER', 'echo "$x_i$"', '```',
    'Literal `$x$`, escaped \\$x\\$, and prices $20 and $30.',
    '> [!WARNING]\n> Keep the original **text**.',
    '- [x] Done\n- [ ] Pending',
    '| 名称 | 值 |\n| --- | --- |\n| x | $a_1$ |',
    '[another](../Nav2_slam.md#标题)',
    '![Diagram](../img/costmap.png)',
    '<script>window.__unsafe = true</script>',
    '<img src="x" onerror="window.__unsafe = true">',
    '[bad](javascript:alert(1))',
    '<span data-test="untrusted" id="article-error" style="position:fixed">safe text</span>'
  ].join('\n\n');
  const result = await page.evaluate((source) => {
    const container = document.createElement('article'); document.body.append(container);
    const headings = RBlogMarkdown.renderMarkdown(container, { markdown: source, title: 'Fixture', path: 'posts/sub/fixture.md' });
    return {
      maths: container.querySelectorAll('.katex').length,
      errors: container.querySelectorAll('.katex-error').length,
      code: container.querySelector('pre code').textContent,
      inline: container.querySelector('p code').textContent,
      headings: headings.map((heading) => heading.id),
      warning: container.querySelector('.callout-warning')?.textContent,
      tasks: container.querySelectorAll('input[type=checkbox]').length,
      table: container.querySelectorAll('.table-scroll table').length,
      link: [...container.querySelectorAll('a')].find((link) => link.textContent === 'another').getAttribute('href'),
      image: container.querySelector('figure img').src,
      unsafe: !!window.__unsafe || !!container.querySelector('script, [onerror], #article-error, [href^="javascript:"]') || container.querySelector('[data-test="untrusted"]').hasAttribute('style'),
      text: container.textContent
    };
  }, fixture);
  assert.equal(result.maths, 5); assert.equal(result.errors, 0);
  assert.match(result.code, /echo \$USER/); assert.match(result.code, /\$x_i\$/);
  assert.equal(result.inline, '$x$'); assert.match(result.text, /prices \$20 and \$30/);
  assert.deepEqual(result.headings, ['重复标题', '重复标题-1']);
  assert.match(result.warning, /Keep the original text/);
  assert.equal(result.tasks, 2); assert.equal(result.table, 1);
  assert.equal(result.link, 'article.html?post=Nav2_slam.md#%E6%A0%87%E9%A2%98');
  assert.equal(result.image, base + '/posts/img/costmap.png');
  assert.equal(result.unsafe, false);
  await page.close();
});

test('search includes article bodies and filters combine and reset', async () => {
  const page = await pageFor(); await page.waitForSelector('.note-card');
  await page.locator('#note-search').fill('HAL_UARTEx_ReceiveToIdle_DMA');
  assert.equal(await page.locator('.note-card').count(), 1);
  assert.match(await page.locator('.note-card').textContent(), /STM32/);
  await page.locator('#tag-filters button').filter({hasText:'Nav2'}).click();
  assert.equal(await page.locator('#search-empty').isVisible(), true);
  await page.locator('#reset-search').click();
  assert.equal(await page.locator('.note-card').count(), manifest.length);
  await page.locator('#expand-tags').click();
  assert.ok(await page.locator('#tag-filters button').count() > 7);
  await page.locator('.theme-toggle').click();
  await page.reload(); await page.waitForSelector('.note-card');
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.close();
});

test('article controls navigate headings, resize text, zoom images and report bad URLs', async () => {
  const page = await pageFor('/article.html?post=Nav2_slam.md'); await page.waitForSelector('.article-image');
  await page.locator('#font-increase').click();
  assert.equal(await page.locator('#article-content').evaluate((element)=>getComputedStyle(element).fontSize), '17px');
  await page.locator('#article-toc a').nth(1).click();
  await page.waitForFunction(()=>location.hash.length>1);
  assert.equal(await page.locator('#article-toc a[aria-current="location"]').count(),1);
  await page.locator('.article-image').first().click();
  assert.equal(await page.locator('#image-dialog').evaluate((dialog)=>dialog.open),true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#image-dialog').evaluate((dialog)=>dialog.open),false);
  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>!document.querySelector('#toc-details').open);
  await page.locator('#toc-details summary').click();
  assert.equal(await page.locator('#toc-details').evaluate((details)=>details.open),true);
  await page.goto(base+'/article.html?post=../content.js');
  await page.waitForSelector('#article-error:not([hidden])');
  assert.equal(await page.locator('#article-body-section').isVisible(),false);
  await page.close();
});
