// Generate the YouTube upload sheet for a topic, from its content JSON.
//
//   node cards/tools/upload.mjs cards/tools/content/0008-apt.json
//   -> cards/0008-apt/upload.md
//
// Generated rather than written by hand so the description cannot drift from
// the card, and so the source and reference date travel with it: for a figure
// that moves, the basis is part of the claim.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
if (!process.argv[2]) {
  console.error('usage: node cards/tools/upload.mjs <content.json>');
  process.exit(1);
}
const d = JSON.parse(readFileSync(resolve(process.argv[2]), 'utf8'));
if (!Array.isArray(d.rows)) {
  // the card-news sets use `lists`, not ranked rows; they carry their own sheet
  console.log(`skip ${d.slug} — not a ranked topic`);
  process.exit(0);
}
const yt = d.youtube || {};
const title = yt.title || d.title.join(' ');
const tags = yt.tags || [];

const rows = d.rows
  .map((r, i) => {
    const n = d.showRank === false ? '·' : String(i + 1).padStart(2, '0');
    return `${n} ${r.label} — ${r.price}${r.sub && d.showRank === false ? ` (${r.sub})` : ''}`;
  })
  .join('\n');

const hashtags = [...tags.slice(0, 7), 'shorts'].map((t) => `#${t}`).join(' ');

const md = `# ${d.slug} — 유튜브 업로드

영상: \`shorts-fit.mp4\` (1080×1920, 20초)
썸네일 후보: \`poster-fit.png\`

## 제목

\`\`\`
${title}
\`\`\`

## 설명

\`\`\`
${d.closing.filter(Boolean).join(' ')}

${d.subtitle}

${rows}

${d.note.slice(0, 3).map((n) => `※ ${n}`).join('\n')}

${d.showRank === false
  ? '어느 숫자가 가장 의외였나요? 댓글에 남겨주세요.'
  : '가장 놀라웠던 순위는 몇 번인가요? 댓글에 남겨주세요.'}

${hashtags}
\`\`\`

## 태그

\`\`\`
${tags.join(', ')}
\`\`\`

## 설정

- 카테고리: 교육
- 시청자층: **아동용 아님** (아동용으로 표시하면 댓글이 막힌다)
- 세로 9:16, 60초 미만이라 쇼츠로 자동 인식된다
- BGM은 직접 합성한 것이라 저작권 신고 대상이 아니다
`;

const out = resolve(HERE, '..', d.slug, 'upload.md');
if (!existsSync(resolve(HERE, '..', d.slug))) {
  console.error(`no output dir for ${d.slug} — render the cards first`);
  process.exit(1);
}
writeFileSync(out, md);
console.log(`-> ${out}`);
