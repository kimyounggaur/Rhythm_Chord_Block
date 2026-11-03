# 음악이론 게임 (가칭) — 개발 안내

이 저장소는 두 설계서를 그대로 구현한 모바일 웹 게임이다. 기능을 고치거나 더할 때는 **먼저 해당 설계서의 절을 읽고** 그 규칙을 따른다.

- 리듬 모드 설계서: `docs/rhythm-tetris-design-v0.1.md` (한 줄 = 한 마디)
- 화음 모드 설계서: `docs/chord-puyo-design-v0.1.md` (타일 = 음, 덩어리 = 화음)
- 에셋 설명서: `docs/rhythm-assets-README.md`, `docs/chord-assets-README.md` — 그림은 `public/assets/rhythm/…`, `public/assets/chord/…`
- 설계서 §17 개발 단계를 요청할 때는 해당 단계 절과 §7·§8·§15·§18·부록을 함께 본다.

## 스택 (두 설계서 §16)

Next.js 15(App Router, 정적 내보내기 `out/`) + TypeScript + Tailwind v4 + shadcn/ui 방식 컴포넌트(`components/ui`) + Zustand + Tone.js(소리) + VexFlow 5(악보, `vexflow/bravura`) + Vitest. 배포는 Vercel(또는 아무 정적 호스팅).
바로 해 보기용 정적 배포본은 같은 화면 코드를 Vite 로 묶는다(`artifact/`, `npm run build:play`).

## 명령

```
npm install
npm run dev          # Next.js 개발 서버 http://localhost:3000  (/rhythm, /chord)
npm test             # Vitest — 설계서 §18 테스트 케이스
npm run typecheck
npm run build        # 정적 사이트 out/ + 서비스 워커(PWA)
npm run build:play   # 바로 해 보기용 정적 배포본 artifact/dist/ (상대 경로, 해시 주소 #/rhythm #/chord)
npm run dev:play     # 위 배포본의 개발 서버 http://127.0.0.1:5173
```

## 폴더

| 폴더 | 내용 |
|---|---|
| `app/` | 라우트: `/`(모드 고르기) `/rhythm` `/chord`. 게임 화면은 `next/dynamic(..., { ssr: false })` 로 불러온다 |
| `components/ui/` | shadcn/ui 방식 공용 컴포넌트(버튼·대화상자·스위치·슬라이더) |
| `components/shell/` | 공용 화면 조각(화면 틀, 조작 버튼, 소리 켜기, 토스트, 떠오르는 점수, 첫 화면) |
| `components/rhythm/`, `components/chord/` | 각 모드 화면(UI). 입구는 `RhythmApp.tsx`, `ChordApp.tsx` |
| `lib/music/` | 공용: 계이름·색·음정, 주요3화음, 오디오 초기화(Tone.js), 저장, 에셋 경로 |
| `lib/game/` | 공용: rAF 게임 루프, DAS/ARR 반복, 키보드, 보드 제스처, 칸 크기 |
| `lib/rhythm/`, `lib/chord/` | 각 모드의 **순수 로직**(화면·소리와 분리, Vitest 로 검사) |
| `data/rhythm/`, `data/chord/` | 설계서 부록의 JSON(박자표·패턴·스테이지 / 화음·진행·스테이지·퍼즐) |
| `store/` | Zustand 상태 |
| `audio/` | 각 모드의 소리(Tone.js). 모든 소리는 Transport 시각으로 예약한다 |
| `tests/` | Vitest |
| `artifact/` | 정적 배포본 입구(Vite) |

## 지킬 것

1. **순수 로직은 `lib/<모드>/`** 에 두고 테스트한다. 화면(`components/`)·소리(`audio/`)와 섞지 않는다(설계서 §16 주의).
2. 게임 화면 코드(`components/`, `lib/`, `store/`, `audio/`)는 `next/*` 를 직접 import 하지 않는다 — 정적 배포본(Vite)과 같은 코드를 쓰기 위해서다. 화면 이동은 `lib/nav.tsx` 의 `useNav()`.
3. 게임 루프는 `requestAnimationFrame` 하나(`lib/game/loop.ts`). `setInterval` 여러 개 금지. 탭이 가려지면 자동 일시정지.
4. 소리는 첫 터치 뒤에만 난다(iOS). `lib/music/audio.ts` 의 `unlockAudio()` 를 터치 처리 안에서 부른다.
5. 저장은 `lib/music/storage.ts`(localStorage, `version` 포함).
6. 코드 식별자·화면 문구에 원작 게임 이름('테트리스'·'뿌요')을 쓰지 않는다(두 설계서 §19-1). 모드 이름은 '리듬 모드'·'화음 모드'.
7. 화면 문구는 한국어, 쉬운 말. 화음 이름은 로마 숫자(Ⅰ·Ⅳ·Ⅴ) + 한글.
