'use client';
// 리듬 모드 전용 애니메이션·스타일. 공용 globals.css 는 건드리지 않고 여기서 <style> 로 넣는다.
const CSS = `
.rhythm-staff svg { overflow: visible; }
/* 공용 떠오르는 글자: 지연(delay) 동안에도 첫 장면(투명·가운데 정렬)을 유지 */
.rh-board .float-text { animation-fill-mode: both; }
.vf-playing path, .vf-playing rect, .vf-playing text { fill: #E8588A !important; stroke: #E8588A !important; }

/* §14-1 마디 완성 연출(300ms): 칸이 음 단위로 합쳐져 알약 → 음표 기호가 뜬 뒤 사라진다 */
@keyframes rh-pill {
  0% { transform: scaleX(.62) scaleY(.9); opacity: .2; filter: brightness(1.5); }
  30% { transform: scaleX(1.05) scaleY(1.06); opacity: 1; filter: brightness(1.25); }
  62% { transform: scale(1); opacity: 1; filter: brightness(1); }
  100% { transform: scale(.82); opacity: 0; }
}
.rh-pill { animation: rh-pill .3s ease-out both; transform-origin: center; }

@keyframes rh-note {
  0% { transform: translate(-50%, 4px) scale(.2); opacity: 0; }
  22% { transform: translate(-50%, -4px) scale(1.18); opacity: 1; }
  55% { transform: translate(-50%, -10px) scale(1); opacity: 1; }
  100% { transform: translate(-50%, -38px) scale(.86); opacity: 0; }
}
.rh-note { position: absolute; animation: rh-note .56s ease-out both; }

@keyframes rh-flash {
  0% { opacity: .95; transform: scaleX(.5); }
  45% { opacity: .85; transform: scaleX(1.04); }
  100% { opacity: 0; transform: scaleX(1.1); }
}
.rh-flash { animation: rh-flash .32s ease-out both; transform-origin: center; }

@keyframes rh-badge {
  0% { transform: translate(-50%, -50%) scale(0) rotate(-24deg); opacity: 0; }
  28% { transform: translate(-50%, -50%) scale(1.25) rotate(8deg); opacity: 1; }
  65% { transform: translate(-50%, -60%) scale(1) rotate(0deg); opacity: 1; }
  100% { transform: translate(-50%, -110%) scale(.8); opacity: 0; }
}
.rh-badge { position: absolute; animation: rh-badge .9s ease-out both; }

@keyframes rh-land { 0% { transform: translateY(-6%) scaleY(.9); } 100% { transform: none; } }
.rh-land { animation: rh-land .12s ease-out both; }

@keyframes rh-shake { 0%,100% { transform: none; } 30% { transform: translateY(3px); } 60% { transform: translateY(-1px); } }
.rh-shake { animation: rh-shake .14s ease-out; }

/* 메트로놈 친구 똑딱이: 박마다 고개를 갸웃 */
.rh-bob { transition: transform .11s ease-out; transform-origin: 50% 92%; }
.rh-bob.l { transform: rotate(-8deg); }
.rh-bob.r { transform: rotate(8deg); }

@keyframes rh-beat { 0% { transform: scale(1.45); opacity: 1; } 100% { transform: scale(1); opacity: .55; } }
.rh-beat { animation: rh-beat .28s ease-out both; }

@keyframes rh-card-in { 0% { transform: translateY(18px) scale(.94); opacity: 0; } 100% { transform: none; opacity: 1; } }
.rh-card-in { animation: rh-card-in .26s ease-out both; }

@keyframes rh-confetti { 0% { transform: translateY(-30px) rotate(0); opacity: 0; } 15% { opacity: 1; } 100% { transform: translateY(160px) rotate(25deg); opacity: 0; } }
.rh-confetti { animation: rh-confetti 1.8s ease-in both; }

@keyframes rh-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
.rh-float { animation: rh-float 2.4s ease-in-out infinite; }

@keyframes rh-glow { 0%,100% { box-shadow: 0 0 0 0 rgba(255,200,61,0); } 50% { box-shadow: 0 0 0 4px rgba(255,200,61,.35); } }
.rh-glow { animation: rh-glow 1.6s ease-in-out infinite; }

.rh-scroll { overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; scrollbar-width: none; touch-action: pan-y; }
.rh-scroll::-webkit-scrollbar { display: none; }

@media (prefers-reduced-motion: reduce) {
  .rh-pill, .rh-note, .rh-flash, .rh-badge, .rh-land, .rh-shake, .rh-beat, .rh-card-in, .rh-confetti, .rh-float, .rh-glow { animation-duration: .01s !important; animation-iteration-count: 1 !important; }
}
`;

export function RhythmStyles() {
  return <style>{CSS}</style>;
}
