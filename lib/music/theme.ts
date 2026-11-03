// 화면 테마(다크 · 화이트). 기본은 다크 — 게임 그림이 밤하늘 톤이라 다크가 원래 모습이다.
// 고른 값은 공용 저장(shell 키)에 남고, <html data-app-theme="light"> 로 적용한다(app/globals.css 의 변수 전환).
import { loadSave, SAVE_KEYS, writeSave } from './storage';

export type AppTheme = 'dark' | 'light';

interface ShellSave {
  version: 1;
  theme: AppTheme;
}

const DEFAULTS: ShellSave = { version: 1, theme: 'dark' };

export function getAppTheme(): AppTheme {
  return loadSave(SAVE_KEYS.shell, DEFAULTS).theme === 'light' ? 'light' : 'dark';
}

export function applyAppTheme(theme: AppTheme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.appTheme = theme === 'light' ? 'light' : 'dark';
}

export function setAppTheme(theme: AppTheme): void {
  writeSave<ShellSave>(SAVE_KEYS.shell, { version: 1, theme });
  applyAppTheme(theme);
}

/** 첫 화면이 그려지기 전에 저장된 테마를 붙이는 인라인 스크립트(app/layout.tsx 에서 사용). 깜빡임 방지. */
export const THEME_BOOT_SCRIPT = `(function(){try{var d=JSON.parse(localStorage.getItem('${SAVE_KEYS.shell}')||'null');if(d&&d.version===1&&d.theme==='light'){document.documentElement.dataset.appTheme='light';}}catch(e){}})();`;
