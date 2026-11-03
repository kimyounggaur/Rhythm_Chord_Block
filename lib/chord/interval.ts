// 떨어지는 쌍의 음정(설계서 §4.4): 아래 음에서 위 음까지 센다. 가로일 때는 왼쪽이 아래 음.
// 계산은 공용 intervalNumber/intervalLabel(((위 − 아래 + 7) % 7) + 1, 같은 음은 "1도(같은 음)").
// 솔♯ 은 솔과 같은 자리로 센다(장·단 구분은 확장 §19).
import { intervalLabel, intervalNumber, type Solfege } from '@/lib/music/solfege';
import type { Pair, Pitch } from './types';

const deg = (q: Pitch): Solfege => (q === '솔♯' ? '솔' : q);

export function pairInterval(p: Pick<Pair, 'axis' | 'satellite' | 'dir'>): { lower: Pitch; upper: Pitch; n: number; label: string } {
  const [lower, upper] = p.dir === 0 || p.dir === 1 ? [p.axis, p.satellite] : [p.satellite, p.axis];
  return { lower, upper, n: intervalNumber(deg(lower), deg(upper)), label: intervalLabel(deg(lower), deg(upper)) };
}
