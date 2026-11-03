// 누르고 있으면 반복되는 입력 — 두 설계서 §5: "누르고 있으면 170ms 뒤부터 50ms마다 반복" (DAS 170ms / ARR 50ms).
// 타이머(setInterval)를 쓰지 않고, 게임 루프(requestAnimationFrame 한 개)에서 update(now) 를 불러 처리한다(설계서 §16 주의).

export interface RepeatOptions {
  /** 처음 반복까지(ms) */
  das?: number;
  /** 반복 간격(ms) */
  arr?: number;
}

export class HoldRepeater<A extends string> {
  private held = new Map<A, { next: number; repeat: boolean }>();
  das: number;
  arr: number;

  constructor(
    private fire: (action: A) => void,
    opts: RepeatOptions = {},
  ) {
    this.das = opts.das ?? 170;
    this.arr = opts.arr ?? 50;
  }

  /** 눌렀을 때. repeat=false 면 한 번만 실행하고 '누르고 있음' 상태만 기억한다(예: 소프트 드롭). */
  down(action: A, now: number = performance.now(), repeat = true) {
    if (this.held.has(action)) return;
    this.held.set(action, { next: now + this.das, repeat });
    this.fire(action);
  }

  up(action: A) {
    this.held.delete(action);
  }

  isHeld(action: A): boolean {
    return this.held.has(action);
  }

  /** 게임 루프에서 매 프레임 부른다. 한 프레임이 길어도 최대 3번까지만 반복(탭 전환 뒤 순간이동 방지). */
  update(now: number) {
    for (const [action, s] of this.held) {
      if (!s.repeat) continue;
      let n = 0;
      while (now >= s.next && n < 3) {
        this.fire(action);
        s.next += this.arr;
        n++;
      }
      if (now >= s.next) s.next = now + this.arr;
    }
  }

  clear() {
    this.held.clear();
  }
}
