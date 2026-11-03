// 저장(localStorage) 공용 도우미 — 두 설계서 §16 "저장은 localStorage(SaveData, version 포함)".
// 사생활 보호 모드·차단 등으로 저장소를 못 쓰면 조용히 기본값으로 동작한다.

export const SAVE_KEYS = {
  rhythm: 'music-games.rhythm.v1',
  chord: 'music-games.chord.v1',
  shell: 'music-games.shell.v1',
} as const;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** 기본값 위에 저장된 값을 덮어쓴다(새로 생긴 설정 항목은 기본값 유지). */
export function mergeDefaults<T>(defaults: T, saved: unknown): T {
  if (!isPlainObject(defaults) || !isPlainObject(saved)) return (saved === undefined ? defaults : (saved as T));
  const out: Record<string, unknown> = { ...(defaults as Record<string, unknown>) };
  for (const [k, v] of Object.entries(saved)) {
    const d = (defaults as Record<string, unknown>)[k];
    out[k] = isPlainObject(d) && isPlainObject(v) ? mergeDefaults(d, v) : v;
  }
  return out as T;
}

/** version 이 다르면 기본값을 돌려준다(나중에 버전이 오르면 여기서 옮겨 담기). */
export function loadSave<T extends { version: number }>(key: string, defaults: T): T {
  try {
    if (typeof localStorage === 'undefined') return structuredClone(defaults);
    const raw = localStorage.getItem(key);
    if (!raw) return structuredClone(defaults);
    const data = JSON.parse(raw);
    if (!isPlainObject(data) || data.version !== defaults.version) return structuredClone(defaults);
    return mergeDefaults(structuredClone(defaults), data);
  } catch {
    return structuredClone(defaults);
  }
}

export function writeSave<T>(key: string, data: T): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    /* 저장 공간이 없거나 막혀 있어도 게임은 계속한다 */
  }
}
