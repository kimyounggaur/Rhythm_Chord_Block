// 정적 배포본(artifact/dist)을 "한 장짜리 페이지 + 함께 올릴 파일 목록"으로 정리한다.
// claude.ai 아티팩트는 페이지 본문만 받고(<html>·<head> 는 올릴 때 자동으로 씌움) 나머지 파일은 상대 경로로 함께 올린다.
//   결과: artifact/dist/page.html, artifact/dist/files-1.json, files-2.json … (한 번에 올릴 수 있는 파일 수 제한 때문에 나눔)
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const DIST = path.resolve(process.argv[2] ?? 'artifact/dist');
const CHUNK = Number(process.argv[3] ?? 240);
const html = readFileSync(path.join(DIST, 'index.html'), 'utf8');

const title = (html.match(/<title>([^<]*)<\/title>/) ?? [])[1] ?? '음악이론 게임';
const links = [...html.matchAll(/<link\b[^>]*>/g)].map((m) => m[0]).filter((t) => /rel="(stylesheet|modulepreload)"/.test(t));
const scripts = [...html.matchAll(/<script\b[^>]*type="module"[^>]*><\/script>/g)].map((m) => m[0]);
if (!scripts.length) throw new Error('module script 를 찾지 못했어요');

const page = [
  `<title>${title}</title>`,
  '<meta name="theme-color" content="#12122F">',
  ...links,
  '<div id="root"></div>',
  ...scripts,
  '',
].join('\n');
writeFileSync(path.join(DIST, 'page.html'), page);

function walk(dir, base = '') {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    if (statSync(full).isDirectory()) out.push(...walk(full, rel));
    else out.push(rel);
  }
  return out;
}

const skip = new Set(['index.html', 'page.html']);
const files = walk(DIST)
  .filter((f) => !skip.has(f) && !/^files-\d+\.json$/.test(f) && !f.startsWith('icons/') && !f.endsWith('.webmanifest') && !f.endsWith('.map'))
  .sort((a, b) => (a.startsWith('app/') === b.startsWith('app/') ? a.localeCompare(b) : a.startsWith('app/') ? -1 : 1));

const chunks = [];
for (let i = 0; i < files.length; i += CHUNK) chunks.push(files.slice(i, i + CHUNK));
chunks.forEach((c, i) => {
  const map = Object.fromEntries(c.map((f) => [f, path.join(DIST, f)]));
  writeFileSync(path.join(DIST, `files-${i + 1}.json`), JSON.stringify(map, null, 1));
});
const bytes = files.reduce((s, f) => s + statSync(path.join(DIST, f)).size, 0) + Buffer.byteLength(page);
console.log(`page.html 만듦 · 함께 올릴 파일 ${files.length}개(${(bytes / 1024 / 1024).toFixed(1)}MB) → ${chunks.length}묶음`);
