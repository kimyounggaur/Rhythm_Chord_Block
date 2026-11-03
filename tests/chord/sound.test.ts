// §9 화음 소리 보이싱: 근음(옥타브 3) + 덩어리의 서로 다른 구성음(옥타브 4), 크기 6 이상이면 근음 옥타브 5 추가
// (Tone.js 없이 음 이름만 검사 — 실제 소리는 브라우저에서 확인)
import { describe, expect, it } from 'vitest';
import { toneName, voicing } from '@/audio/chord';
import { pairInterval } from '@/lib/chord/interval';

describe('화음 소리 보이싱(§9)', () => {
  it('Ⅰ 4성부: C3 + C4 E4 G4', () => {
    expect(voicing({ chord: 'I', size: 4, toneCounts: { 도: 2, 미: 1, 솔: 1 } })).toEqual(['C3', 'C4', 'E4', 'G4']);
  });
  it('크기 6 이상이면 근음을 옥타브 5에도', () => {
    expect(voicing({ chord: 'I', size: 6, toneCounts: { 도: 2, 미: 2, 솔: 2 } })).toEqual(['C3', 'C4', 'E4', 'G4', 'C5']);
  });
  it('Ⅴ7: G3 + G4 B4 D4 F4, 가단조 Ⅴ: E3 + E4 G#4 B4', () => {
    expect(voicing({ chord: 'V7', size: 4, toneCounts: { 솔: 1, 시: 1, 레: 1, 파: 1 } })).toEqual(['G3', 'G4', 'B4', 'D4', 'F4']);
    expect(voicing({ chord: 'Va', size: 4, toneCounts: { 미: 2, '솔♯': 1, 시: 1 } })).toEqual(['E3', 'E4', 'G#4', 'B4']);
    expect(toneName('솔♯', 5)).toBe('G#5');
  });
  it('덩어리에 없는 구성음은 울리지 않는다(Ⅴ7 대신 Ⅴ 로 터진 덩어리)', () => {
    expect(voicing({ chord: 'V', size: 4, toneCounts: { 솔: 1, 시: 1, 레: 2 } })).toEqual(['G3', 'G4', 'B4', 'D4']);
  });
});

describe('떨어지는 쌍의 음정(§4.4): 아래 음 → 위 음, 가로면 왼쪽이 아래 음', () => {
  it('도(축) 위에 솔(위성) = 5도, 뒤집으면 솔→도 = 4도(자리바꿈)', () => {
    expect(pairInterval({ axis: '도', satellite: '솔', dir: 0 })).toMatchObject({ lower: '도', upper: '솔', n: 5 });
    expect(pairInterval({ axis: '도', satellite: '솔', dir: 2 })).toMatchObject({ lower: '솔', upper: '도', n: 4 });
  });
  it('가로: 위성이 오른쪽(1)이면 축이 아래 음, 왼쪽(3)이면 위성이 아래 음', () => {
    expect(pairInterval({ axis: '미', satellite: '도', dir: 1 }).n).toBe(6);
    expect(pairInterval({ axis: '미', satellite: '도', dir: 3 }).n).toBe(3);
    expect(pairInterval({ axis: '레', satellite: '레', dir: 0 }).label).toBe('1도(같은 음)');
  });
});
