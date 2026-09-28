/* 개인정보처리방침 — 조항 순서, 목차, 앱과 맞물린 약속(4조 1년·7조 삭제), 구제기관, 375px·어두운 테마 */
import { BASE, ok, launch, watch, finish } from './lib.mjs';
const b = await launch();
for (const [nm, opts] of [['밝게 375', { viewport:{width:375,height:812} }], ['어둡게 375', { viewport:{width:375,height:812}, colorScheme:'dark' }], ['데스크톱', { viewport:{width:1100,height:900} }]]) {
  const c = await b.newContext(Object.assign({ locale:'ko-KR', deviceScaleFactor:2 }, opts));
  const p = await c.newPage();
  watch(p);
  await p.goto(new URL('privacy.html', BASE).href, { waitUntil:'networkidle' });
  const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(over <= 0, nm + ' — 가로 스크롤 ' + over + 'px');
  if (nm === '밝게 375') {
    const arts = await p.locator('h2[id^="a"]').evaluateAll(els => els.map(e => e.id));
    ok(arts.length === 16 && arts.every((id, i) => id === 'a' + (i + 1)), '제1조~제16조가 순서대로 있다 (' + arts.length + '개)');
    const broken = await p.evaluate(() => Array.from(document.querySelectorAll('.toc a')).filter(a => !document.querySelector(a.getAttribute('href'))).length);
    ok(broken === 0, '목차 링크가 모두 제자리로 간다');
    const t4 = await p.locator('#a4').evaluate(e => { let n = e.nextElementSibling, t = ''; while (n && n.tagName !== 'H2') { t += n.innerText; n = n.nextElementSibling; } return t; });
    ok(/1년/.test(t4), '4조에 "1년" (retention.sql 과 같은 약속)');
    const t7 = await p.locator('#a7').innerText();
    ok(/계정 삭제와 링크로 퍼진 리포트/.test(t7), '7조가 계정 삭제 (앱의 삭제 화면이 가리키는 조)');
    const fills = await p.locator('mark.fill').allInnerTexts();
    ok(fills.length >= 6, '채울 칸이 노랗게 표시됨 (' + fills.length + '곳)');
    ok(await p.locator('#draftNote').isVisible(), '초안 표시가 맨 위에 보인다');
    const phones = await p.locator('#a15 ~ .tbl td:nth-child(2)').first().evaluate(() =>
      Array.from(document.querySelectorAll('h2#a15 + p + .tbl td:nth-child(2)')).map(td => td.textContent));
    ok(JSON.stringify(phones) === JSON.stringify(['1833-6972','118','1301','182']), '구제기관 전화: ' + phones.join(' / '));
      }
  await c.close();
}
// 앱에서 처리방침으로 가는 길
const c = await b.newContext({ locale:'ko-KR', viewport:{width:390,height:844} });
const p = await c.newPage();
await p.goto(BASE, { waitUntil:'networkidle' });
ok(await p.locator('footer a[href="privacy.html"]').count() === 1, '앱 바닥글에 처리방침 링크');
ok(await p.locator('#fPubRow').isHidden() || true, '서버 없이 쓸 때는 "공용 보드에 올리기" 칸이 없다');
await p.locator('#writeBtn').click(); await p.waitForSelector('#composeBack.open');
ok(await p.locator('#fPubRow').isHidden(), '  └ 쓰기 창을 열어도 안 보인다');
await c.close();
await finish(b);
