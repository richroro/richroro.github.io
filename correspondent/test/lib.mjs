/* 검사 묶음들이 함께 쓰는 것. 각 묶음은 `node test/<이름>.mjs` 로 따로 돌고,
   실패가 하나라도 있으면 종료 코드 1 로 끝난다(CI 가 빨개진다).

   앱 주소는 APP_URL 로 바꾼다. 기본은 저장소 뿌리를 8199 에 띄운 경우다:
     python3 -m http.server 8199      (저장소 뿌리에서)
*/
import { chromium } from 'playwright';

export const BASE = process.env.APP_URL || 'http://127.0.0.1:8199/correspondent/';
export const MIN = 60e3;

let pass = 0, fail = 0;
const errors = [];

export function ok(cond, msg) {
  if (cond) { pass++; console.log('  ok  ' + msg); }
  else { fail++; console.log('  FAIL ' + msg); }
}
export const section = (t) => console.log('\n== ' + t + ' ==');

/* 콘솔 오류를 모은다. 이 환경(과 CI)에서 Google Fonts 가 막히는 건 앱 탓이 아니라 뺀다. */
export function watch(page, name = '') {
  page.on('pageerror', (e) => errors.push((name ? name + ': ' : '') + e.message));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !/ERR_CERT|fonts\.g|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION/.test(t))
      errors.push((name ? name + ' ' : '') + 'console: ' + t);
  });
  return page;
}

export async function launch(opts) { return chromium.launch(opts); }

/* 공유 창의 글은 압축(pack)이 끝나야 채워진다. 창이 열린 것만 보고 읽으면 "만드는 중…"을 읽는다 —
   글꼴을 받아 오느라 바쁜 CI 러너에서 실제로 그렇게 떨어졌다. 끝날 때까지 기다렸다가 읽는다. */
export async function shareReady(p) {
  await p.waitForSelector('#shareBack.open');
  await p.waitForFunction(() => !document.querySelector('#shareBox').value.includes('만드는 중'));
  return p.inputValue('#shareBox');
}
/* 묶음도 같다. 정해 둔 시간만큼 자지 않고, 상태 줄이 됐다(ok)거나 안 됐다(err)고 할 때까지 기다린다. */
export async function bundleReady(p) {
  await p.waitForSelector('#bundleStatus.ok, #bundleStatus.err');
  return p.locator('#bundleStatus').innerText();
}

export async function context(browser, opts = {}) {
  return browser.newContext(Object.assign({ locale: 'ko-KR', timezoneId: 'Asia/Seoul', viewport: { width: 1000, height: 900 } }, opts));
}

/* 보드를 심고 연다. reports 를 주면 예시 대신 그걸로 시작한다. */
export async function openWith(ctx, reports, extra = {}) {
  const p = watch(await ctx.newPage());
  await p.goto(BASE, { waitUntil: 'networkidle' });
  if (reports) {
    await p.evaluate(({ rs, ex }) => localStorage.setItem('tpw.v1',
      JSON.stringify(Object.assign({ reports: rs, me: '나', seeded: true }, ex))), { rs: reports, ex: extra });
    await p.reload({ waitUntil: 'networkidle' });
  }
  return p;
}

export function report(o) {
  return Object.assign({ id: Math.random().toString(36).slice(2, 10), t: Date.now(), by: '가', cat: 'food',
    place: '어디', area: '', wait: -1, crowd: -1, park: -1, rate: 0, tags: [], note: '' }, o);
}

export async function finish(browser) {
  ok(errors.length === 0, '콘솔 오류 없음' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  if (browser) await browser.close();
  console.log('\n==== ' + pass + ' 통과 / ' + fail + ' 실패 ====');
  process.exit(fail ? 1 : 0);
}
