/* ============================================================================
   스크립트 주소에 내용 버전을 적는다.

     node correspondent/tools/stamp.mjs            index.html·admin.html 의 ?v= 를 지금 내용으로 고친다
     node correspondent/tools/stamp.mjs --check    고칠 게 있으면 무엇을 하라고 적고 종료 코드 1

   app.js·sync.js·admin.js 가운데 하나라도 고쳤으면 이걸 돌려서 같이 커밋한다. test/pwa 가 같은 것을 본다.

   왜: 깃허브 페이지스는 파일마다 10분씩 브라우저에 묵히고(max-age=600), 신호가 약하면 서비스 워커가 캐시의
   사본을 꺼낸다. 주소가 같으면 새 index.html 에 옛 app.js 가 붙어 빈 화면이 된다. 주소가 내용을 따라 바뀌면
   섞일 수 없다 — 새 index.html 은 새 주소를 부르고, 워커는 ?v= 가 붙은 파일을 주소가 곧 내용인 것으로 다룬다.
   그래서 고쳐 놓고 안 돌리면 새 내용이 옛 주소로 나가고, 그 주소를 캐시에 가진 폰은 옛 사본을 계속 쓴다.

   H 는 app.js, sync.js, admin.js 를 이 순서로 이어 붙인 바이트의 sha256 을 16진으로 적은 앞 10자다.
   index.html 은 sync.js?v=H·app.js?v=H 를, admin.html 은 sync.js?v=H·admin.js?v=H 를 부른다.
   app.js 는 제 주소의 H 를 읽어 워커를 sw.js?v=H 로 등록하고, 워커는 캐시 이름을 tpw-H 로 짓는다.
   config.js 는 운영자가 손으로 고치는 파일이라 버전을 붙이지 않는다(워커는 늘 네트워크부터 본다).
   ========================================================================== */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const APP = resolve(HERE, '..');
export const SCRIPTS = ['app.js', 'sync.js', 'admin.js'];   // 이 순서로 해시한다 — 바꾸면 H 가 바뀐다
export const PAGES = ['index.html', 'admin.html'];

/** H — 스크립트 셋을 이 순서로 이어 붙인 바이트의 sha256, 16진 앞 10자. */
export function version(dir = APP) {
  const h = createHash('sha256');
  for (const f of SCRIPTS) h.update(readFileSync(resolve(dir, f)));
  return h.digest('hex').slice(0, 10);
}

/** <script src="app.js·sync.js·admin.js"> 의 ?v= 를 v 로 적는다(없으면 붙인다). config.js 는 그대로. */
export const stampHtml = (html, v) => html.replace(/(<script src="(?:app|sync|admin)\.js)(?:\?v=[^"]*)?"/g, '$1?v=' + v + '"');

/** 지금 내용과 ?v= 가 안 맞는 문서 이름들. */
export function stale(dir = APP) {
  const v = version(dir);
  return PAGES.filter((f) => { const html = readFileSync(resolve(dir, f), 'utf8'); return stampHtml(html, v) !== html; });
}

const main = process.argv[1] && realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url));
if (main) {
  const check = process.argv.includes('--check');
  const dir = resolve(process.argv.slice(2).find((a) => !a.startsWith('--')) || APP);   // 폴더를 주면 그 사본에서
  const v = version(dir), bad = stale(dir);
  if (check) {
    if (bad.length) {
      console.error('스크립트 버전(?v=)이 내용과 안 맞습니다: ' + bad.join(', ') + ' — 지금 내용은 v=' + v + '\n' +
        '  node correspondent/tools/stamp.mjs  를 돌리고 바뀐 파일을 같이 커밋하세요.');
      process.exit(1);
    }
    console.log('스크립트 버전이 맞습니다: v=' + v);
  } else {
    for (const f of bad) writeFileSync(resolve(dir, f), stampHtml(readFileSync(resolve(dir, f), 'utf8'), v));
    console.log('v=' + v + (bad.length ? ' — ' + bad.join(', ') + ' 를 고쳤습니다.' : ' — 이미 맞습니다.'));
  }
}
