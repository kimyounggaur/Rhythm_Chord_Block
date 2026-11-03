import { describe, expect, it } from 'vitest';
import { intervalLabel, intervalNumber } from '@/lib/music/solfege';
import { triadOf } from '@/lib/music/chords';
import { HoldRepeater } from '@/lib/game/repeat';
import { mergeDefaults } from '@/lib/music/storage';

describe('공용 음악 정의', () => {
  it('음정: 아래 음에서 위 음까지 (화음 §4.4)', () => {
    expect(intervalNumber('도', '솔')).toBe(5);
    expect(intervalNumber('솔', '도')).toBe(4); // 자리바꿈
    expect(intervalLabel('미', '미')).toBe('1도(같은 음)');
    expect(intervalLabel('시', '레')).toBe('3도');
  });

  it('주요3화음 판정 (리듬 §7-6)', () => {
    expect(triadOf(['도', '솔'])).toBe('I');
    expect(triadOf(['레', '솔'])).toBe('V');
    expect(triadOf(['도', '파'])).toBe('IV');
    expect(triadOf(['도', '도'])).toBeNull(); // 계이름 하나뿐
    expect(triadOf(['도', '레'])).toBeNull();
  });
});

describe('누르고 있으면 반복 (DAS 170 / ARR 50)', () => {
  it('170ms 뒤부터 50ms마다', () => {
    const fired: number[] = [];
    let t = 0;
    const r = new HoldRepeater<'left'>(() => fired.push(t));
    r.down('left', 0);
    for (t = 0; t <= 330; t += 10) r.update(t);
    expect(fired).toEqual([0, 170, 220, 270, 320]);
  });
});

describe('저장 기본값 합치기', () => {
  it('새 설정 항목은 기본값 유지', () => {
    const d = { version: 1, settings: { sound: true, volume: 0.8 }, list: [1] };
    const m = mergeDefaults(d, { version: 1, settings: { sound: false } });
    expect(m.settings).toEqual({ sound: false, volume: 0.8 });
    expect(m.list).toEqual([1]);
  });
});
