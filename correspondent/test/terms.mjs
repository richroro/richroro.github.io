/* 이용약관·운영정책 — 조항 순서, 목차, 그리고 **약속이 코드와 맞는지**.
   약관의 숫자(신고 몇 명이면 가림, 도배 한도, 임시조치 기간, 기록 보관)는 서버 SQL 에서 읽어 와 대조한다.
   앱과 운영 화면이 가리키는 "운영정책 N조"가 실제로 그 조인지도 본다 — 조를 옮기면 여기서 떨어진다. */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE, ok, launch, watch, finish } from './lib.mjs';

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(resolve(APP, f), 'utf8');
const num = (src, re, what) => { const m = src.match(re); if (!m) throw new Error(what + ' 를 SQL 에서 못 찾았습니다'); return Number(m[1]); };

const policies = read('server/policies.sql'), admin = read('server/admin.sql'), retention = read('server/retention.sql');
const HIDE_AT = num(policies, /hidden = \(hidden or n >= (\d+)\)/, '가림 기준');
const PER_HOUR = num(policies, /interval '1 hour'\) < (\d+)/, '시간당 한도');
const PER_DAY = num(policies, /interval '1 day'\)\s+< (\d+)/, '하루 한도');
const FLAGS_DAY = num(policies, /select count\(\*\) < (\d+) from flags/, '신고 하루 한도');
const HOLD_DAYS = num(admin, /held_until = now\(\) \+ interval '(\d+) days'/, '임시조치 기간');
ok(/delete from mod_log where at < now\(\) - interval ''1 year''/.test(retention), '서버: 처리 기록은 1년 뒤 지운다 (retention.sql)');
const KO = { 2: '두', 3: '세', 4: '네', 5: '다섯' };

const b = await launch();
const text = (p, id) => p.locator('#' + id).evaluate((e) => {
  let t = e.innerText, n = e.nextElementSibling;
  while (n && !/^H[12]$/.test(n.tagName)) { t += '\n' + n.innerText; n = n.nextElementSibling; }
  return t;
});

for (const [nm, opts] of [['밝게 375', { viewport: { width: 375, height: 812 } }], ['어둡게 375', { viewport: { width: 375, height: 812 }, colorScheme: 'dark' }],
                          ['데스크톱', { viewport: { width: 1100, height: 900 } }]]) {
  const c = await b.newContext(Object.assign({ locale: 'ko-KR' }, opts));
  const p = watch(await c.newPage());
  await p.goto(new URL('terms.html', BASE).href, { waitUntil: 'networkidle' });
  const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(over <= 0, nm + ' — 가로 스크롤 ' + over + 'px');
  if (nm !== '밝게 375') { await c.close(); continue; }

  const ts = await p.locator('h2[id^="t"]').evaluateAll((els) => els.map((e) => e.id));
  ok(ts.length === 16 && ts.every((id, i) => id === 't' + (i + 1)), '이용약관: 제1조~제15조와 부칙이 순서대로 (' + ts.length + '개)');
  const ps = await p.locator('h2[id^="p"]').evaluateAll((els) => els.map((e) => e.id));
  ok(ps.length === 6 && ps.every((id, i) => id === 'p' + (i + 1)), '운영정책: 1조~6조가 순서대로 (' + ps.length + '개)');
  ok(await p.locator('h1#policy').count() === 1, '  └ 운영정책은 따로 된 제목(h1) 아래에');
  const broken = await p.evaluate(() => Array.from(document.querySelectorAll('main a[href^="#"]'))
    .filter((a) => !document.querySelector(a.getAttribute('href'))).map((a) => a.getAttribute('href')));
  ok(broken.length === 0, '문서 안 링크가 모두 제자리로 간다' + (broken.length ? ': ' + broken.join(' ') : ''));
  ok(await p.locator('#draftNote').isVisible() && (await p.locator('mark.fill').count()) >= 4, '초안 상자와 채울 칸(노랑)');
  const csp = await p.evaluate(() => (document.querySelector('meta[http-equiv="Content-Security-Policy"]') || {}).content || '');
  ok(/script-src 'none'/.test(csp), "스크립트 없는 문서 — script-src 'none'");

  /* 약속 = 코드 */
  ok(new RegExp(KO[HIDE_AT] + ' 사람이 신고하면').test(await text(p, 't8')), `제8조: ${KO[HIDE_AT]} 사람이 신고하면 가림 = policies.sql 의 n >= ${HIDE_AT}`);
  ok((await text(p, 'p2')).includes(KO[HIDE_AT] + ' 사람'), `  └ 운영정책 2조도 ${KO[HIDE_AT]} 사람`);
  ok((await text(p, 't7')).includes(`한 시간에 ${PER_HOUR}건, 하루 ${PER_DAY}건`), `제7조: 도배 한도 한 시간 ${PER_HOUR}건·하루 ${PER_DAY}건 = policies.sql`);
  ok((await text(p, 'p2')).includes(`하루 ${FLAGS_DAY}건`), `운영정책 2조: 신고 하루 ${FLAGS_DAY}건 = policies.sql`);
  ok((await text(p, 'p3')).includes(`최대 ${HOLD_DAYS}일`) && (await text(p, 't8')).includes(`최대 ${HOLD_DAYS}일`), `임시조치 최대 ${HOLD_DAYS}일 = admin.sql (제8조·운영정책 3조)`);
  ok(/1년/.test(await text(p, 'p6')), '운영정책 6조: 처리 기록 1년 = retention.sql');
  ok((await text(p, 't5')).includes('만 14세 이상'), '제5조: 만 14세 이상 (로그인 확인란과 같음)');

  /* 앱·운영 화면이 가리키는 조 */
  const app = read('app.js'), adminJs = read('admin.js'), adminHtml = read('admin.html'), runbook = read('RUNBOOK.md');
  const head = async (id) => p.locator('#' + id).innerText();
  ok(/운영정책 5조/.test(app) && /이의 신청/.test(await head('p5')), '앱의 정지 안내 "운영정책 5조" → 5조가 이의 신청');
  ok(/운영정책 3조/.test(adminHtml) && /임시조치/.test(await head('p3')), '운영 화면의 "운영정책 3조" → 3조가 임시조치');
  ok(/운영정책 4조/.test(adminJs) && /이용 제한/.test(await head('p4')), '운영 화면의 정지 사유 "운영정책 4조" → 4조가 이용 제한 기준');
  ok(/운영정책 1조/.test(runbook) && /가리거나 지웁니다/.test(await head('p1')), '운영 매뉴얼의 "운영정책 1조" → 1조가 가리고 지우는 기준');
  await c.close();
}

/* 앱에서 약관으로 가는 길, 처리방침과 맞물린 곳 */
const c = await b.newContext({ locale: 'ko-KR', viewport: { width: 390, height: 844 } });
const p = watch(await c.newPage());
await p.goto(BASE, { waitUntil: 'networkidle' });
ok(await p.locator('footer a[href="terms.html"]').count() === 1, '앱 바닥글에 이용약관 링크');
await p.goto(new URL('privacy.html', BASE).href, { waitUntil: 'networkidle' });
const t4 = await text(p, 'a4');
ok(/처리 기록/.test(t4) && /1년/.test(t4), '처리방침 4조에 운영자 처리 기록과 1년');
ok(await p.locator('a[href="terms.html#policy"]').count() >= 1, '처리방침 1조가 운영정책을 가리킨다');
await c.close();
await finish(b);
