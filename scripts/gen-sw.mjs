// next build 뒤에 out/sw.js(서비스 워커)를 만든다 — 두 설계서 §17 M7 "홈 화면 추가 뒤 오프라인 실행".
// out/ 의 모든 파일을 미리 저장(precache)하고, 이후에는 저장본을 먼저 쓴다(게임이라 서버 데이터가 없음).
// 파일 내용이 바뀌면 캐시 이름이 바뀌어 새 버전으로 교체된다.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(process.argv[2] ?? 'out');
const SKIP = new Set(['sw.js']);

function walk(dir, base = '') {
  const files = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    if (statSync(full).isDirectory()) files.push(...walk(full, rel));
    else if (!SKIP.has(rel) && !name.endsWith('.map')) files.push(rel);
  }
  return files;
}

const files = walk(OUT).sort();
const hash = createHash('sha256');
for (const f of files) hash.update(f).update(readFileSync(path.join(OUT, f)));
const version = hash.digest('hex').slice(0, 12);

// '/rhythm/index.html' 같은 파일은 '/rhythm/' 주소로도 찾을 수 있게 한다(trailingSlash 정적 내보내기)
const urls = files.map((f) => '/' + f);
const sw = `// 자동 생성 파일(scripts/gen-sw.mjs) — 고치지 말 것
const CACHE = 'music-games-${version}';
const PRECACHE = ${JSON.stringify(urls)};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

function cacheKey(url) {
  const u = new URL(url);
  if (u.origin !== self.location.origin) return null;
  let p = u.pathname;
  if (p.endsWith('/')) p += 'index.html';
  return p;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const key = cacheKey(req.url);
  if (!key) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = (await cache.match(key, { ignoreSearch: true })) || (await cache.match(req, { ignoreSearch: true }));
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok && res.type === 'basic') cache.put(key, res.clone());
        return res;
      } catch (e) {
        if (req.mode === 'navigate') {
          const home = await cache.match('/index.html');
          if (home) return home;
        }
        throw e;
      }
    }),
  );
});
`;
writeFileSync(path.join(OUT, 'sw.js'), sw);
const size = files.reduce((s, f) => s + statSync(path.join(OUT, f)).size, 0);
console.log(`sw.js: 파일 ${files.length}개 미리 저장(${(size / 1024 / 1024).toFixed(1)}MB), 버전 ${version}`);
