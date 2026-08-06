// 验证触屏设备上边缘工具条能被唤出。
//
// 注意分清三种状态：
//   - 加载中：.overlay (z=200) 盖住一切，工具条本来就不该出现
//   - 模态打开（本地文件选择 / 存档面板）：.backdrop (z=300) 同理
//   - 游戏进行中：两者都被 v-if 移除，只剩 canvas —— 这才是玩家抱怨的场景
// 所以"能不能唤出"必须在第三种状态下测。
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'http://localhost:8787';
const PASSWORD = process.env.ADMIN_PASSWORD || 'test-password-123';
const results = [];
const ok = (name, cond) => results.push([name, !!cond]);

// 自建一个条目再删掉：不依赖库里已有数据，空库也能跑。
// downloadUrl 指向不可达域名 —— 我们只测工具条，不需要真的把游戏跑起来。
async function login() {
    const res = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: PASSWORD })
    });
    if (!res.ok) throw new Error(`登录失败 (${res.status})，检查 .dev.vars 里的 ADMIN_PASSWORD_HASH`);
    return (res.headers.get('set-cookie') || '').split(';')[0];
}

const cookie = await login();

async function createFixture() {
    const res = await fetch(`${BASE}/api/admin/games`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({
            title: '工具条测试用条目',
            downloadUrl: 'https://example.invalid/never.xp3',
            published: 1
        })
    });
    if (!res.ok) throw new Error(`创建测试条目失败 (${res.status})`);
    return (await res.json()).game.id;
}

const GAME_ID = await createFixture();

const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
});

async function newPage(touch) {
    const page = await browser.newPage();
    // puppeteer 的 emulateMediaFeatures 不认 hover，直接走 CDP
    const cdp = await page.createCDPSession();
    await cdp.send('Emulation.setEmulatedMedia', {
        features: [
            { name: 'hover', value: touch ? 'none' : 'hover' },
            { name: 'pointer', value: touch ? 'coarse' : 'fine' }
        ]
    });
    // SW 会拿旧 chunk 顶掉新构建，绕开它，否则测的是上一版代码
    await cdp.send('Network.enable');
    await cdp.send('Network.setBypassServiceWorker', { bypass: true });
    if (touch) {
        await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
    } else {
        await page.setViewport({ width: 1280, height: 800 });
    }
    return page;
}

const waitForToolbar = (page) =>
    page.waitForFunction(() => {
        const bar = document.querySelector('.bar');
        return bar && getComputedStyle(bar).display !== 'none';
    }, { timeout: 3000 }).then(() => true).catch(() => false);

/** 复现"游戏进行中"的 DOM：把 v-if 会移除的加载浮层/模态摘掉。 */
const enterRunningState = (page) => page.evaluate(() => {
    document.querySelectorAll('.overlay, .backdrop, .modal-backdrop').forEach((el) => el.remove());
    return document.querySelectorAll('.overlay, .backdrop, .modal-backdrop').length;
});

// --- 触屏：把手的存在与尺寸 ---
{
    const page = await newPage(true);
    await page.goto(`${BASE}/play/${GAME_ID}`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.handle', { timeout: 8000 }).catch(() => {});

    const handle = await page.$('.handle');
    ok('触屏：把手已渲染', handle);
    if (handle) {
        const box = await handle.boundingBox();
        ok('触屏：把手在顶部居中', box && box.y < 60 && Math.abs((box.x + box.width / 2) - 195) < 40);
        ok('触屏：命中区 >= 44px 高', box && box.height >= 44);
    }
    await page.close();
}

// --- 游戏进行中：真实手指点击 ---
{
    const page = await newPage(true);
    await page.goto(`${BASE}/play/${GAME_ID}`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.handle', { timeout: 8000 }).catch(() => {});
    ok('进行中：浮层已清空', (await enterRunningState(page)) === 0);

    const h = await page.$('.handle');
    if (h) {
        const b = await h.boundingBox();
        const onTop = await page.evaluate((x, y) => {
            const el = document.elementFromPoint(x, y);
            return !!(el && el.closest('.handle'));
        }, b.x + b.width / 2, b.y + b.height / 2);
        ok('进行中：把手未被遮挡（命中测试）', onTop);

        await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
        ok('进行中：真实手指点击能展开工具条', await waitForToolbar(page));
    }
    await page.close();
}

// --- 游戏进行中：顶边下滑 ---
{
    const page = await newPage(true);
    await page.goto(`${BASE}/play/${GAME_ID}`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.handle', { timeout: 8000 }).catch(() => {});
    await enterRunningState(page);

    await page.touchscreen.touchStart(195, 10);
    await page.touchscreen.touchMove(195, 35);
    await page.touchscreen.touchMove(195, 60);
    await page.touchscreen.touchEnd();
    ok('进行中：顶边下滑能展开工具条', await waitForToolbar(page));
    await page.close();
}

// --- 桌面不受影响 ---
{
    const page = await newPage(false);
    await page.goto(`${BASE}/play/${GAME_ID}`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1200));
    await enterRunningState(page);

    ok('桌面：不渲染把手', !(await page.$('.handle')));
    await page.mouse.move(640, 2);
    ok('桌面：鼠标移到顶端能展开', await waitForToolbar(page));
    await page.close();
}

await browser.close();

// 清掉测试条目，别把库弄脏
await fetch(`${BASE}/api/admin/games/${GAME_ID}`, {
    method: 'DELETE',
    headers: { Cookie: cookie }
}).catch(() => {});

let bad = 0;
for (const [name, pass] of results) {
    console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}`);
    if (!pass) bad++;
}
console.log(bad ? `\n✗ ${bad} 项问题` : '\n✓ 全部通过');
process.exit(bad ? 1 : 0);
