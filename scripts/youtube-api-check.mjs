#!/usr/bin/env node
//
// 만든 YouTube Data API 키가 실제로 먹는지 확인한다. 의존성 없음 (Node 18+).
//
//   node scripts/youtube-api-check.mjs                      # .env 또는 YOUTUBE_API_KEY 에서 읽음
//   node scripts/youtube-api-check.mjs AIza...              # 키를 직접 넘김
//   node scripts/youtube-api-check.mjs --referer https://richroro.github.io/
//                                                           # 웹사이트 제한 걸린 키를 터미널에서 테스트
//
// videos.list 한 번 = 할당량 1유닛. 하루 10,000유닛이므로 마음껏 돌려도 된다.

import { readFileSync } from 'node:fs';

const HINTS = {
  accessNotConfigured:
    '이 프로젝트에 YouTube Data API v3 가 켜져 있지 않다. 콘솔 > API 및 서비스 > 라이브러리에서 사용 설정한다.',
  SERVICE_DISABLED:
    '이 프로젝트에 YouTube Data API v3 가 켜져 있지 않다. 콘솔 > API 및 서비스 > 라이브러리에서 사용 설정한다.',
  keyInvalid: '키 문자열이 틀렸다. 복사하다 잘렸는지, 지운 키를 쓰고 있는지 확인한다.',
  API_KEY_INVALID: '키 문자열이 틀렸다. 복사하다 잘렸는지, 지운 키를 쓰고 있는지 확인한다.',
  ipRefererBlocked:
    "키에 걸린 제한과 지금 호출하는 위치가 안 맞는다. 웹사이트(리퍼러) 제한 키는 브라우저에서만 먹으므로 터미널 테스트는 --referer 를 붙인다. 서버에서 쓸 키라면 제한을 'IP 주소'로 바꾼다.",
  API_KEY_HTTP_REFERRER_BLOCKED:
    '리퍼러 제한에 걸렸다. 콘솔의 허용 리퍼러 목록에 이 주소가 있는지 확인한다 (예: https://richroro.github.io/*).',
  API_KEY_IP_ADDRESS_BLOCKED: 'IP 제한에 걸렸다. 지금 나가는 공인 IP 를 허용 목록에 넣는다 (curl ifconfig.me 로 확인).',
  API_KEY_SERVICE_BLOCKED:
    "키의 'API 제한사항' 에 YouTube Data API v3 가 빠져 있다. 콘솔에서 이 API 를 선택 목록에 추가한다.",
  quotaExceeded: '오늘 할당량 10,000유닛을 다 썼다. 태평양시 자정(한국시간 오후 4~5시)에 리셋된다.',
  RESOURCE_EXHAUSTED: '오늘 할당량을 다 썼다. 태평양시 자정(한국시간 오후 4~5시)에 리셋된다.',
  forbidden: '키가 요청에 안 붙었거나 권한이 없다. key 파라미터가 실제로 실려 가는지 확인한다.',
};

const args = process.argv.slice(2);
let referer = '';
const rest = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--referer' || args[i] === '--referrer') referer = args[++i] ?? '';
  else if (args[i] === '-h' || args[i] === '--help') { usage(); process.exit(0); }
  else rest.push(args[i]);
}

const key = rest[0] || process.env.YOUTUBE_API_KEY || fromDotEnv();
if (!key) {
  console.error('키가 없다. 아래 중 하나로 넘긴다.\n');
  usage();
  process.exit(2);
}

const url = new URL('https://www.googleapis.com/youtube/v3/videos');
url.searchParams.set('part', 'snippet');
url.searchParams.set('chart', 'mostPopular');
url.searchParams.set('regionCode', 'KR');
url.searchParams.set('maxResults', '1');
url.searchParams.set('key', key);

const headers = {};
if (referer) {
  headers.Referer = referer;
  try {
    headers.Origin = new URL(referer).origin;
  } catch {
    console.error(`[에러] --referer 값이 URL 이 아니다: ${referer}`);
    console.error('  예: --referer https://richroro.github.io/');
    process.exit(2);
  }
}

let res, body;
try {
  res = await fetch(url, { headers });
  body = await res.json();
} catch (err) {
  console.error(`[실패] 네트워크 오류: ${err.message}`);
  process.exit(1);
}

if (res.ok) {
  const title = body.items?.[0]?.snippet?.title ?? '(제목 없음)';
  console.log('[성공] 키가 정상 동작한다.');
  console.log(`  키    : ${mask(key)}`);
  console.log(`  응답  : 한국 인기 동영상 1위 — ${title}`);
  console.log(`  비용  : 1유닛 (하루 10,000유닛, 태평양시 자정 리셋)`);
  process.exit(0);
}

// 진짜 원인은 errors[0].reason (badRequest 처럼 뭉뚱그려짐) 이 아니라
// details[].reason (API_KEY_INVALID 등) 에 들어 있다. 구체적인 쪽부터 본다.
const err = body.error ?? {};
const reasons = [
  ...(err.details ?? []).map((d) => d.reason).filter(Boolean),
  err.errors?.[0]?.reason,
  err.status,
].filter(Boolean);
const reason = reasons[0] ?? String(res.status);
console.error(`[실패] ${res.status} ${reason}`);
console.error(`  ${err.message ?? '(메시지 없음)'}`);
const hint = HINTS[reasons.find((r) => HINTS[r])];
if (hint) console.error(`\n  원인/해결: ${hint}`);
process.exit(1);

// ---------------------------------------------------------------- helpers

function usage() {
  console.error([
    '  node scripts/youtube-api-check.mjs AIza...',
    '  YOUTUBE_API_KEY=AIza... node scripts/youtube-api-check.mjs',
    "  echo 'YOUTUBE_API_KEY=AIza...' >> .env && node scripts/youtube-api-check.mjs",
  ].join('\n'));
}

function fromDotEnv() {
  try {
    const line = readFileSync('.env', 'utf8')
      .split('\n')
      .find((l) => /^\s*YOUTUBE_API_KEY\s*=/.test(l));
    return line ? line.split('=').slice(1).join('=').trim().replace(/^['"]|['"]$/g, '') : '';
  } catch {
    return '';
  }
}

function mask(k) {
  return k.length > 12 ? `${k.slice(0, 6)}…${k.slice(-4)}` : '…';
}
