// 화음 모드 연출용 CSS(키프레임). 공용 globals.css 를 건드리지 않으려고 화음 모드 화면에서 <style> 로 한 번 넣는다.
// 낙하·터짐 연출은 CSS transition/animation(설계서 §16 주의 4). 터짐 450ms(§6.1).
export const CHORD_CSS = `
.cm-tile { position:absolute; left:0; top:0; will-change:transform; }
.cm-tile > img { width:100%; height:100%; display:block; pointer-events:none; user-select:none; }
.cm-halo { position:absolute; left:0; top:0; will-change:transform; transition: opacity .12s ease-out; }
@keyframes cm-pop {
  0% { transform: scale(1); filter: brightness(1); opacity: 1; }
  22% { transform: scale(1.16); filter: brightness(1.55) saturate(1.2); opacity: 1; }
  55% { transform: scale(1.06); filter: brightness(1.35); opacity: 1; }
  100% { transform: scale(.2); filter: brightness(2); opacity: 0; }
}
.cm-popping > img { animation: cm-pop .45s cubic-bezier(.3,.7,.4,1) forwards; }
@keyframes cm-junk {
  0% { transform: scale(1) rotate(0); opacity: 1; }
  40% { transform: scale(1.08) rotate(-6deg); opacity: 1; }
  100% { transform: scale(.2) rotate(18deg); opacity: 0; }
}
.cm-junking > img { animation: cm-junk .45s ease-in forwards; }
@keyframes cm-flash { 0% { opacity: 0; } 18% { opacity: .95; } 45% { opacity: .55; } 100% { opacity: 0; } }
.cm-flash { animation: cm-flash .45s ease-out forwards; }
@keyframes cm-shards { 0% { transform: translate(-50%,-50%) scale(.35); opacity: 0; } 25% { opacity: 1; } 100% { transform: translate(-50%,-50%) scale(1.75); opacity: 0; } }
.cm-shards { animation: cm-shards .6s ease-out forwards; }
@keyframes cm-burst { 0% { transform: translate(-50%,-50%) scale(.2) rotate(0deg); opacity: 0; } 30% { opacity: .95; } 100% { transform: translate(-50%,-50%) scale(1.3) rotate(24deg); opacity: 0; } }
.cm-burst { animation: cm-burst .7s ease-out forwards; mix-blend-mode: screen; }
@keyframes cm-ring { 0% { transform: translate(-50%,-50%) scale(.25); opacity: .95; } 100% { transform: translate(-50%,-50%) scale(2.3); opacity: 0; } }
.cm-ring { animation: cm-ring .6s ease-out forwards; }
@keyframes cm-chip {
  0% { transform: translate(-50%, 10px) scale(.7); opacity: 0; }
  12% { transform: translate(-50%, 0) scale(1.06); opacity: 1; }
  20% { transform: translate(-50%, 0) scale(1); opacity: 1; }
  82% { transform: translate(-50%, -4px) scale(1); opacity: 1; }
  100% { transform: translate(-50%, -14px) scale(.96); opacity: 0; }
}
.cm-chip { position:absolute; animation: cm-chip 1.25s ease-out forwards; pointer-events:none; }
@keyframes cm-badge { 0% { transform: scale(.3) rotate(-25deg); opacity: 0; } 55% { transform: scale(1.18) rotate(6deg); opacity: 1; } 100% { transform: scale(1) rotate(0); opacity: 1; } }
.cm-chain-badge { animation: cm-badge .35s cubic-bezier(.3,1.6,.5,1) both; }
@keyframes cm-strip-in { 0% { transform: translateY(-10px) scale(.96); opacity: 0; } 100% { transform: translateY(0) scale(1); opacity: 1; } }
.cm-strip-in { animation: cm-strip-in .25s ease-out both; }
@keyframes cm-strip-badge { 0% { transform: scale(.2); opacity: 0; } 70% { transform: scale(1.15); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
.cm-strip-badge { animation: cm-strip-badge .3s cubic-bezier(.3,1.5,.5,1) both; }
@keyframes cm-interval { 0% { transform: scale(1.35); filter: drop-shadow(0 0 10px #ffe680) brightness(1.25); } 100% { transform: scale(1); filter: none; } }
.cm-interval-pop { animation: cm-interval .42s cubic-bezier(.3,1.4,.5,1); }
@keyframes cm-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
.cm-hint { animation: cm-bob 1.4s ease-in-out infinite, cm-strip-badge .3s ease-out; }
@keyframes cm-mascot { 0%,100% { transform: translateY(0) rotate(0); } 50% { transform: translateY(-3px) rotate(-2deg); } }
.cm-mascot { animation: cm-mascot 2.2s ease-in-out infinite; transform-origin: 50% 100%; }
@keyframes cm-jump { 0% { transform: translateY(0) scale(1); } 30% { transform: translateY(-12px) scale(1.06); } 60% { transform: translateY(0) scale(.97,1.03); } 100% { transform: translateY(0) scale(1); } }
.cm-mascot-happy { animation: cm-jump .55s ease-out 2; transform-origin: 50% 100%; }
@keyframes cm-ribbon { 0% { transform: translateY(-40px) scale(.6); opacity: 0; } 60% { transform: translateY(4px) scale(1.06); opacity: 1; } 100% { transform: translateY(0) scale(1); opacity: 1; } }
.cm-ribbon { animation: cm-ribbon .5s cubic-bezier(.3,1.4,.5,1) both; }
@keyframes cm-confetti { 0% { transform: translateY(-30px); opacity: 0; } 15% { opacity: 1; } 100% { transform: translateY(150px); opacity: 0; } }
.cm-confetti { animation: cm-confetti 2.4s ease-in infinite; }
@keyframes cm-allclear { 0% { transform: translate(-50%,-50%) scale(.4); opacity: 0; } 18% { transform: translate(-50%,-50%) scale(1.08); opacity: 1; } 80% { transform: translate(-50%,-50%) scale(1); opacity: 1; } 100% { transform: translate(-50%,-60%) scale(.95); opacity: 0; } }
.cm-allclear { animation: cm-allclear 1.8s ease-out forwards; }
@keyframes cm-fadeout { 0% { opacity: 1; } 75% { opacity: 1; } 100% { opacity: 0; } }
.cm-hintbar { animation: cm-strip-in .25s ease-out both; }
@keyframes cm-shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-3px); } 75% { transform: translateX(3px); } }
.cm-shake { animation: cm-shake .18s linear 2; }
/* 공용 토스트(ToastHost)는 가운데 정렬 위에 left:50%·translateX(-50%) 가 겹쳐 오른쪽으로 밀린다 — 화음 모드 안에서만 바로잡는다 */
.cm-scroll { overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: #4a4aa8 transparent; }
.cm-roman { font-family: Georgia, 'Times New Roman', 'Noto Serif', 'DejaVu Serif', 'Liberation Serif', serif; font-weight: 700; font-size: .94em; letter-spacing: .01em; }
.cm-text-shadow { text-shadow: 0 2px 0 rgba(30,20,80,.9), 0 0 6px rgba(30,20,80,.7); }
@media (prefers-reduced-motion: reduce) {
  .cm-popping > img, .cm-junking > img, .cm-flash, .cm-shards, .cm-burst, .cm-ring, .cm-chip, .cm-chain-badge,
  .cm-strip-in, .cm-interval-pop, .cm-hint, .cm-mascot, .cm-mascot-happy, .cm-ribbon, .cm-confetti, .cm-allclear, .cm-shake {
    animation-duration: .01s !important; animation-iteration-count: 1 !important;
  }
}
`;
