// ページを実際に動かすテスト（Firebase エミュレータ + Chromium）。npm test から呼ばれます。
// AI（Gemini）と Google ログインはテスト用の偽物に置きかえ、本物のデータには触れません。
import {chromium} from 'playwright';
import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {execFileSync} from 'child_process';
import {fileURLToPath} from 'url';

const REPO = fileURLToPath(new URL('..', import.meta.url));
const NM = fileURLToPath(new URL('./node_modules/firebase/', import.meta.url));
const EMU = {auth: '127.0.0.1:9099', firestore: '127.0.0.1:8080'};
// 作成者のメールアドレスは、ルールの owners() から読む
const OWNER = fs.readFileSync(path.join(REPO, 'firestore.rules'), 'utf8').match(/function owners\(\) \{ return \['([^']+)'/)[1];

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) pass++; else { fail++; console.log('NG:', name, detail === undefined ? '' : '— ' + JSON.stringify(detail)); }
}

// ---------- サイトを一時フォルダに組み立てる ----------
function makeSite(config, cspExtra) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'genka-site-'));
  fs.mkdirSync(path.join(dir, 'tools'));
  fs.copyFileSync(path.join(REPO, 'index.html'), path.join(dir, 'index.html'));
  fs.copyFileSync(path.join(REPO, 'tools/build.py'), path.join(dir, 'tools/build.py'));
  execFileSync('python3', [path.join(dir, 'tools/build.py'), ...cspExtra], {stdio: 'ignore'});
  fs.writeFileSync(path.join(dir, 'firebase-config.js'), 'window.GENKA_CONFIG=' + JSON.stringify(config) + ';');
  return dir;
}
function serve(dir) {
  return new Promise(res => {
    const srv = http.createServer((q, r) => {
      const f = path.join(dir, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
      if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
      r.writeHead(200, {'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8'});
      fs.createReadStream(f).pipe(r);
    }).listen(0, '127.0.0.1', () => res({srv, url: 'http://127.0.0.1:' + srv.address().port + '/'}));
  });
}

// 偽物の Gemini（firebase-app.js / firebase-ai.js の代わり）。window.FAKE_AI='fail' で接続エラーを再現
const FAKE_AI = `
export function initializeApp(){return {};}
export function getAI(){return {};}
export function GoogleAIBackend(){}
export function getGenerativeModel(ai,o){return {model:'models/'+o.model,generateContent:async(p)=>{
  if(window.FAKE_AI==='fail')throw new Error('[403] Firebase AI Logic API has not been used in project genka-book before or it is disabled.');
  const c=String(p).split('<comment>').pop();
  const bad=/へたっぴ/.test(c);
  return {response:{text:()=>JSON.stringify(bad?{ok:false,reason:'からかい'}:{ok:true})}};
}};}`;

// ---------- 1. index.html の CSP が最新か ----------
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'genka-csp-'));
  fs.mkdirSync(path.join(dir, 'tools'));
  fs.copyFileSync(path.join(REPO, 'index.html'), path.join(dir, 'index.html'));
  fs.copyFileSync(path.join(REPO, 'tools/build.py'), path.join(dir, 'tools/build.py'));
  execFileSync('python3', [path.join(dir, 'tools/build.py')], {stdio: 'ignore'});
  const same = fs.readFileSync(path.join(dir, 'index.html'), 'utf8') === fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
  check('index.html の CSP が最新（変えたら python3 tools/build.py を実行）', same);
}

// エミュレータのデータを空にする
await fetch(`http://${EMU.firestore}/emulator/v1/projects/demo-genka/databases/(default)/documents`, {method: 'DELETE'});
await fetch(`http://${EMU.auth}/emulator/v1/projects/demo-genka/accounts`, {method: 'DELETE'});

const fbSite = makeSite({
  firebase: {apiKey: 'demo-key', projectId: 'demo-genka', authDomain: 'demo-genka.firebaseapp.com'},
  emulator: EMU,
}, ['http://' + EMU.firestore, 'http://' + EMU.auth]);
const localSite = makeSite({firebase: null}, []);
const fb = await serve(fbSite), local = await serve(localSite);

const browser = await chromium.launch(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {});
const problems = [];
async function open(name, url, init) {
  const ctx = await browser.newContext({viewport: {width: 390, height: 844}});
  const p = await ctx.newPage();
  p.on('pageerror', e => problems.push(name + ': ' + e.message));
  p.on('console', m => { if (/Content Security Policy|Refused to/i.test(m.text())) problems.push(name + ': ' + m.text().slice(0, 160)); });
  await p.route('https://www.gstatic.com/**', r => {
    const f = r.request().url().split('/').pop();
    if (/compat\.js$/.test(f)) return r.fulfill({path: NM + f, contentType: 'text/javascript'});
    return r.fulfill({body: FAKE_AI, contentType: 'text/javascript'});
  });
  await p.route('https://fonts.googleapis.com/**', r => r.fulfill({body: '', contentType: 'text/css'}));
  if (init) await p.addInitScript(init);
  await p.goto(url || fb.url);
  await p.waitForSelector('.sub', {timeout: 15000});
  await p.waitForTimeout(1500);
  return p;
}
const toast = async p => { await p.waitForTimeout(200); return (await p.locator('.toast').textContent().catch(() => '')) || ''; };
async function google(p, sub, email) {
  await p.evaluate(async ([s, e]) => {
    await firebase.auth().signInWithCredential(firebase.auth.GoogleAuthProvider.credential(JSON.stringify({sub: s, email: e, email_verified: true})));
  }, [sub, email]);
  await p.reload(); await p.waitForSelector('.sub'); await p.waitForTimeout(1500);
}
// 保存が終わる（rate 制限の待ち時間を含む）まで待つ
async function until(p, fn, ms = 15000) { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await p.waitForTimeout(300); } return false; }

try {
  // ---------- 2. ゲストが作品を登録して、写真付きで公開 ----------
  const a = await open('alice');
  check('Firebase モードで起動', (await a.locator('.sub').textContent()) === 'あなた専用の帳簿');
  check('ルールが最新と判定される', (await a.locator('.banner').count()) === 0);
  await a.click('text=サンプルを入れて試す');
  check('サンプルの作品が2件入る', await until(a, async () => (await a.locator('.rows .row').count()) === 2));
  await a.locator('.rows .row').first().click();
  await a.setInputFiles('#photo', {name: 'p.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')});
  await a.waitForTimeout(600);
  await a.click('[data-act=set-vis][data-v=public]');
  await a.fill('#nick', 'アリス');
  await a.click('[data-act=save-work]');
  check('保存して公開のメッセージ', /保存して公開しました/.test(await toast(a)));
  check('公開がサーバーに保存される', await until(a, async () => (await a.locator('.badge.pub').count()) === 1));
  await a.waitForTimeout(1500);
  check('公開時にエラーが出ない', !/できませんでした/.test(await toast(a)));

  // ---------- 3. 別のゲスト：見る・いいね不可・コメント・AIで悪口を止める ----------
  const b = await open('bob');
  await b.click('.bnav [data-v=gallery]');
  check('別の人に公開作品が見える', await until(b, async () => (await b.locator('.pub').count()) === 1));
  check('写真が見える', await until(b, async () => (await b.locator('.pub img.ph').count()) === 1));
  check('作者名が見える', /アリス/.test(await b.locator('.pub .meta').first().textContent()));
  await b.click('.pub [data-act=like]');
  check('ゲストはいいねできない', /Googleでログイン/.test(await toast(b)));
  await b.click('.pub [data-act=toggle-c]');
  await b.locator('.pub input[data-bind=nick]').fill('ボブ');
  await b.locator('.pub input[data-bind=draft]').fill('すてきな色です');
  await b.click('.pub [data-act=post-c]');
  check('コメントが保存される', await until(b, async () => (await b.locator('.clist li').count()) === 1));
  await b.waitForTimeout(1000);
  check('コメント時にエラーが出ない', !/できませんでした/.test(await toast(b)), await toast(b));
  await b.locator('.pub input[data-bind=draft]').fill('へたっぴだね');
  await b.click('.pub [data-act=post-c]');
  check('AIが悪口を止める', /からかい/.test(await toast(b)));
  await b.locator('.pub input[data-bind=draft]').fill('2つめのコメント');
  await b.click('.pub [data-act=post-c]');
  check('続けてコメントしても（自動で待って）保存される', await until(b, async () => (await b.locator('.clist li').count()) === 2, 20000));

  // ---------- 4. AIにつながらないときは送信しない＆理由を出す ----------
  const f = await open('frank', fb.url, () => { window.FAKE_AI = 'fail'; });
  await f.click('.bnav [data-v=gallery]');
  await until(f, async () => (await f.locator('.pub').count()) === 1);
  await f.click('.pub [data-act=toggle-c]');
  await f.locator('.pub input[data-bind=nick]').fill('フランク');
  await f.locator('.pub input[data-bind=draft]').fill('こんにちは');
  await f.click('.pub [data-act=post-c]');
  check('AIが使えないときは送信せず理由を表示', /Firebase AI Logic が有効になっていません/.test(await toast(f)), await toast(f));

  // ---------- 5. Googleログインした人：いいね・スーパーいいね ----------
  const c = await open('carol');
  await google(c, 'carol', 'carol@example.com');
  await c.click('.bnav [data-v=gallery]');
  await until(c, async () => (await c.locator('.pub').count()) === 1);
  await c.click('.pub [data-act=like]');
  check('Googleログインした人はいいねできる', await until(c, async () => (await c.locator('.pub [data-act=like]').textContent()).trim() === '1'));
  await c.waitForTimeout(1200);
  await c.click('.pub [data-act=super]');
  check('スーパーいいねは2回押しで確認', await until(c, async () => /もう一度/.test(await c.locator('.chip.sup').textContent()), 3000));
  await c.click('.pub [data-act=super]');
  check('スーパーいいねが送れる', /送りました/.test(await toast(c)));
  check('スーパーいいねが保存される', await until(c, async () => /スーパー 1/.test(await c.locator('.chip.sup').textContent())));
  await c.waitForTimeout(1200);
  await c.click('.pub [data-act=super]');
  check('2回目のスーパーいいねは断られる', /使い切りました/.test(await toast(c)));
  check('いいね時にエラーが出ない', !/できませんでした/.test(await toast(c)));

  // ---------- 6. 作成者 ----------
  const o = await open('owner');
  await google(o, 'owner1', OWNER);
  check('作成者には管理タブが出る', (await o.locator('.bnav [data-v=mod]').count()) === 1);
  await o.click('.bnav [data-v=gallery]');
  check('作成者からも、いいね1・コメント2が見える', await until(o, async () =>
    (await o.locator('.pub [data-act=like]').textContent()).trim() === '1' && /コメント 2/.test(await o.locator('.pub [data-act=toggle-c]').textContent())));
  await o.click('.bnav [data-v=mod]');
  await o.click('[data-act=ai-test]');
  check('AIの接続テストが成功と出る', await until(o, async () => /接続できました/.test(await o.locator('.panel').allTextContents().then(t => t.join()))));
  const other = await open('mallory');
  await google(other, 'mallory', 'mallory@example.com');
  check('作成者以外には管理タブが出ない', (await other.locator('.bnav [data-v=mod]').count()) === 0);

  // ---------- 7. Firebase なし（この端末に保存）でも動く ----------
  const l = await open('local', local.url);
  check('設定が空ならこの端末に保存するモード', (await l.locator('.sub').textContent()) === 'この端末に保存');
  await l.click('text=サンプルを入れて試す');
  check('この端末に保存するモードでもサンプルが入る', await until(l, async () => (await l.locator('.rows .row').count()) === 2));

  // ---------- 8. ほかのサイトに埋め込まれたら動かない ----------
  const fr = await (await browser.newContext()).newPage();
  await fr.setContent(`<iframe src="${fb.url}" width="400" height="300"></iframe>`);
  await fr.waitForTimeout(2500);
  const inner = fr.frames()[1];
  check('ほかのサイトへの埋め込みを拒否', /で開いてください/.test(await inner.locator('main').textContent()));

  // ---------- 9. コンソールのルールが古いときは、作成者に分かるように知らせる ----------
  const rulesUrl = `http://${EMU.firestore}/emulator/v1/projects/demo-genka:securityRules`;
  const setRules = content => fetch(rulesUrl, {method: 'PUT', body: JSON.stringify({rules: {files: [{name: 'firestore.rules', content}]}})});
  await setRules("rules_version='2';service cloud.firestore{match /databases/{db}/documents{match /pub/{x}{allow read:if true;} match /likes/{x}{allow read:if true;} match /cmts/{x}{allow read:if true;} match /reports/{x}{allow read:if true;} match /mod/{x}{allow read:if true;}}}");
  const ow2 = await open('owner-old-rules');
  await google(ow2, 'owner1', OWNER);
  check('ルールが古いと作成者に案内が出る', await until(ow2, async () => /ルールが古いまま/.test(await ow2.locator('.banner').allTextContents().then(t => t.join()))));
  const gu2 = await open('guest-old-rules');
  check('ルールが古いとき、ほかの人には「設定を更新しています」と出る', await until(gu2, async () => /設定を更新しています/.test(await gu2.locator('.banner').allTextContents().then(t => t.join()))));
  await setRules(fs.readFileSync(path.join(REPO, 'firestore.rules'), 'utf8'));

  check('CSP違反やスクリプトエラーがない', problems.length === 0, problems);
} catch (e) {
  fail++; console.log('NG: テストが途中で止まりました —', e.message.split('\n')[0]);
} finally {
  await browser.close(); fb.srv.close(); local.srv.close();
}
console.log('ページのテスト: 成功', pass, '件 / 失敗', fail, '件');
if (fail) process.exit(1);
