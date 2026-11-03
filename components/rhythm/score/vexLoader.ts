'use client';
// VexFlow 5 를 늦게 불러온다 — 글꼴이 들어 있는 'vexflow/bravura' 판(CDN 글꼴을 받지 않음, §16 주의 1).
// 음악 글꼴(Bravura)이 실제로 쓸 수 있게 된 뒤에 그려야 기호가 네모로 나오지 않는다.
import type { VF } from './vexBuild';

let loading: Promise<VF> | null = null;
let loaded: VF | null = null;

export function loadVex(): Promise<VF> {
  if (loaded) return Promise.resolve(loaded);
  if (!loading) {
    loading = import('vexflow/bravura')
      .then(async (m) => {
        // 이름 있는 내보내기(StaveNote, Renderer …)를 쓴다 — vexBuild 의 VF 타입과 같은 모양
        const vf = m as unknown as VF;
        // 'vexflow/bravura' 가 FontFace 로 글꼴을 등록한다 — 다 받아질 때까지 기다린다
        if (typeof document !== 'undefined' && document.fonts) {
          try {
            await Promise.race([
              Promise.all([document.fonts.load('30px Bravura'), document.fonts.load('12px Academico')]),
              new Promise((r) => setTimeout(r, 2500)),
            ]);
          } catch {
            /* 글꼴 대기 실패해도 그린다 */
          }
        }
        loaded = vf;
        return vf;
      })
      .catch((e) => {
        loading = null;
        throw e;
      });
  }
  return loading;
}

export function vexIfLoaded(): VF | null {
  return loaded;
}
