'use client';
// 설정(§13: 소리 · 패드 · 조작 방식 · 힌트 · 음정 표시) — 저장(SaveData.settings)
import { useState, type ReactNode } from 'react';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { unlockAudio } from '@/lib/music/audio';
import type { AutoBool, Settings } from '@/lib/chord/types';
import { useChordStore } from '@/store/chord';
import { cn } from '@/lib/utils';
import { Img, Panel, ScreenHeader } from './bits';
import { RText } from './Roman';

function Row({ icon, label, sub, children }: { icon: string; label: string; sub?: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-line/40 py-2.5 last:border-b-0">
      <Img path={`chord/icons/${icon}.svg`} style={{ width: 34, height: 34 }} className="shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-[18px] leading-tight text-ink">{label}</div>
        {sub && (
          <div className="text-[12px] leading-snug text-ink-dim">
            <RText text={sub} />
          </div>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Seg<T extends string | boolean>({ value, options, set }: { value: T; options: { v: T; label: string }[]; set: (v: T) => void }) {
  return (
    <div className="flex rounded-full border-2 border-line bg-bg2 p-0.5">
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          onClick={() => set(o.v)}
          className={cn('h-8 rounded-full px-2.5 text-[14px] transition-colors', value === o.v ? 'bg-gold text-ink-dark' : 'text-ink-dim')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const AUTO: { v: AutoBool; label: string }[] = [
  { v: 'auto', label: '스테이지대로' },
  { v: true, label: '켬' },
  { v: false, label: '끔' },
];

export function SettingsScreen() {
  const s = useChordStore((x) => x.save.settings);
  const update = useChordStore((x) => x.updateSettings);
  const back = useChordStore((x) => x.back);
  const go = useChordStore((x) => x.go);
  const reset = useChordStore((x) => x.resetProgress);
  const [confirm, setConfirm] = useState(false);
  const set = (p: Partial<Settings>) => update(p);
  return (
    <div className="flex h-full flex-col">
      <ScreenHeader title="설정" onBack={() => go(back === 'settings' || back === 'game' ? 'menu' : back)} />
      <div className="cm-scroll min-h-0 flex-1 px-3 pb-4">
        <div className="mx-auto flex max-w-[420px] flex-col gap-3">
          <Panel className="px-3 py-1">
            <Row icon={s.sound ? 'icon-sound-on' : 'icon-sound-off'} label="소리">
              <Switch
                checked={s.sound}
                onCheckedChange={(v) => {
                  unlockAudio().catch(() => undefined);
                  set({ sound: v });
                }}
                aria-label="소리"
              />
            </Row>
            <div className="flex items-center gap-3 border-b border-line/40 py-2.5">
              <span className="w-[34px] shrink-0 text-center text-[13px] text-ink-dim">음량</span>
              <Slider value={[Math.round(s.volume * 100)]} min={0} max={100} step={5} onValueChange={([v]) => set({ volume: v / 100 })} aria-label="음량" />
              <span className="w-10 shrink-0 text-right text-[15px] text-ink">{Math.round(s.volume * 100)}</span>
            </div>
            <Row icon="icon-pad" label="긴장과 해결 패드" sub="보드가 높아지면 배경 화음이 Ⅰ에서 Ⅴ로 바뀌어요">
              <Switch checked={s.tensionPad} onCheckedChange={(v) => set({ tensionPad: v })} aria-label="긴장 패드" />
            </Row>
          </Panel>
          <Panel className="px-3 py-1">
            <Row icon="icon-play" label="조작 방식" sub="제스처: 밀기 이동 · 톡 회전 · 두 손가락 반대 회전 · 아래로 튕겨 내리기">
              <span />
            </Row>
            <div className="flex justify-end pb-2.5">
              <Seg
                value={s.controls}
                options={[
                  { v: 'buttons', label: '버튼' },
                  { v: 'gestures', label: '제스처' },
                  { v: 'both', label: '둘 다' },
                ]}
                set={(v) => set({ controls: v })}
              />
            </div>
          </Panel>
          <Panel className="px-3 py-1">
            <Row icon="icon-hint" label="부족한 음 힌트" sub="스테이지 1~6은 켜고, 7부터는 꺼요">
              <span />
            </Row>
            <div className="flex justify-end pb-2">
              <Seg value={s.hints} options={AUTO} set={(v) => set({ hints: v })} />
            </div>
            <Row icon="icon-interval" label="음정 표시" sub="떨어지는 두 음 사이 '5도'처럼(스테이지 3부터 켬)">
              <span />
            </Row>
            <div className="flex justify-end pb-2.5">
              <Seg value={s.intervalLabel} options={AUTO} set={(v) => set({ intervalLabel: v })} />
            </div>
          </Panel>
          <Panel className="px-3 py-1">
            <Row icon="icon-lock" label="모든 스테이지 열기" sub="선생님용 — 순서와 상관없이 고를 수 있어요">
              <Switch checked={s.unlockAll} onCheckedChange={(v) => set({ unlockAll: v })} aria-label="모든 스테이지 열기" />
            </Row>
            <div className="flex items-center justify-between gap-2 py-2.5">
              <span className="text-[15px] text-ink-dim">점수·클리어·도감 기록</span>
              {confirm ? (
                <span className="flex gap-1.5">
                  <Button size="sm" variant="secondary" onClick={() => setConfirm(false)}>
                    아니요
                  </Button>
                  <Button
                    size="sm"
                    variant="pink"
                    onClick={() => {
                      reset();
                      setConfirm(false);
                    }}
                  >
                    지우기
                  </Button>
                </span>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => setConfirm(true)}>
                  기록 지우기
                </Button>
              )}
            </div>
          </Panel>
          <p className="px-2 text-center text-[12px] leading-snug text-ink-dim">
            키보드: ← → 이동 · ↑ 또는 X 회전 · Z 반대 회전 · ↓ 천천히 · Space 한 번에 · P 일시정지
          </p>
        </div>
      </div>
    </div>
  );
}
