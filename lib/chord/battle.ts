// 대전 준비(설계서 §17 M10, §10 끝, §19-11) — 화면 없이 규격만.
//   BattleAdapter { attackFrom(result: ChainResult): number; receive(n: number): void; isDead(): boolean }
//   공격량 = 단계 점수 ÷ 60 (나머지는 다음 단계로 이월). 값은 대전 문서에서 다시 정한다.
import { SCORE_TABLE } from './defs';
import type { ChainResult } from './types';

export interface BattleAdapter {
  attackFrom(result: ChainResult): number;
  receive(n: number): void;
  isDead(): boolean;
}

export interface BattleTarget {
  receiveGarbage(n: number): void;
  isDead(): boolean;
}

export class ChordBattleAdapter implements BattleAdapter {
  /** 아직 공격으로 바꾸지 못한 점수(다음 단계로 이월) */
  carry = 0;
  constructor(
    private target: BattleTarget,
    private divisor: number = SCORE_TABLE.attackDivisor,
  ) {}

  attackFrom(result: ChainResult): number {
    let attack = 0;
    for (const step of result.steps) {
      const total = this.carry + step.score;
      attack += Math.floor(total / this.divisor);
      this.carry = total % this.divisor;
    }
    return attack;
  }

  receive(n: number): void {
    this.target.receiveGarbage(n);
  }

  isDead(): boolean {
    return this.target.isDead();
  }
}
