// 한 판 기록(RunStats) — 설계서 §14-8 게임 오버 요약의 숫자가 여기서 나온다.
//   터뜨린 화음별 횟수 · 최대 연쇄 · 마침꼴별 횟수 · 공통음 동시 횟수 · 최대 성부 · 새로 등록한 진행 · 이번 판 최고의 연쇄
import type { ChainResult, RunStats } from './types';

export function emptyStats(): RunStats {
  return {
    pieces: 0,
    popsByChord: {},
    maxChain: 0,
    cadences: {},
    sharedPops: 0,
    maxGroup: 0,
    newCollections: [],
    bestChain: null,
    chains: 0,
    allClears: 0,
    reverseCount: 0,
  };
}

/** 연쇄 결과 하나를 기록에 더한다(새 객체를 돌려준다) */
export function addChain(s: RunStats, r: ChainResult, newCollections: string[] = []): RunStats {
  if (!r.chain) return s;
  const popsByChord = { ...s.popsByChord };
  const cadences = { ...s.cadences };
  let sharedPops = s.sharedPops;
  let maxGroup = s.maxGroup;
  let reverseCount = s.reverseCount;
  for (const step of r.steps) {
    for (const e of step.events) {
      popsByChord[e.chord] = (popsByChord[e.chord] ?? 0) + 1;
      maxGroup = Math.max(maxGroup, e.size);
    }
    if (step.sharedCount > 0) sharedPops++;
    if (step.progressionName && step.pairBonus > 0) cadences[step.progressionName] = (cadences[step.progressionName] ?? 0) + 1;
    if (step.reverseHint) reverseCount++;
    for (const q of step.sequences) cadences[q.name] = (cadences[q.name] ?? 0) + 1;
  }
  const better = !s.bestChain || r.chain > s.bestChain.chain || (r.chain === s.bestChain.chain && r.totalScore > s.bestChain.totalScore);
  return {
    ...s,
    popsByChord,
    cadences,
    sharedPops,
    maxGroup,
    reverseCount,
    maxChain: Math.max(s.maxChain, r.chain),
    newCollections: [...s.newCollections, ...newCollections.filter((id) => !s.newCollections.includes(id))],
    bestChain: better ? stripResult(r) : s.bestChain,
    chains: s.chains + 1,
    allClears: s.allClears + (r.allClear ? 1 : 0),
  };
}

/** 기록에는 보드 장면(frames) 같은 무거운 것을 빼고 둔다 */
function stripResult(r: ChainResult): ChainResult {
  return {
    steps: r.steps,
    chain: r.chain,
    progression: r.progression,
    totalScore: r.totalScore,
    allClear: r.allClear,
    collectionId: r.collectionId,
  };
}
