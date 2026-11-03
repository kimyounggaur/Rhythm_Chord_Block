'use client';
// 설정(§13·§15 Settings): 소리 · 음량 · 메트로놈 · 조작 방식 · ⟲ 버튼 · 고스트 음표 미리보기 · 악보 표기 엄격도
import type { ReactNode } from 'react';
import { asset } from '@/lib/music/assets';
import type { Settings } from '@/lib/rhythm/types';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { R } from './art';

function Row({ label, hint, children, icon }: { label: string; hint?: string; children: ReactNode; icon?: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      {icon && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={asset(R(`icons/${icon}.svg`))} alt="" className="h-8 w-8 shrink-0" draggable={false} />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[17px] leading-tight text-ink">{label}</div>
        {hint && <div className="text-[12px] leading-snug text-ink-dim">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-xl bg-bg2 p-0.5">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={cn('rounded-[10px] px-2.5 py-1.5 text-[14px] leading-none transition-colors', value === o.v ? 'bg-gold text-ink-dark' : 'text-ink-dim')}
          aria-pressed={value === o.v}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SettingsDialog({ open, onOpenChange, settings, onChange }: { open: boolean; onOpenChange: (o: boolean) => void; settings: Settings; onChange: (p: Partial<Settings>) => void }) {
  const ghost: 'auto' | 'on' | 'off' = settings.ghostPreview === null ? 'auto' : settings.ghostPreview ? 'on' : 'off';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-[400px] overflow-y-auto">
        <DialogTitle className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset(R('icons/icon-settings.svg'))} alt="" className="h-9 w-9" />
          설정
        </DialogTitle>
        <div className="divide-y divide-line/60">
          <Row label="소리" icon={settings.sound ? 'icon-sound-on' : 'icon-sound-off'}>
            <Switch checked={settings.sound} onCheckedChange={(v) => onChange({ sound: v })} aria-label="소리" />
          </Row>
          <div className="py-2">
            <div className="mb-1 flex items-center justify-between text-[15px] text-ink">
              <span>음량</span>
              <span className="text-ink-dim">{Math.round(settings.volume * 100)}</span>
            </div>
            <Slider value={[Math.round(settings.volume * 100)]} min={0} max={100} step={5} onValueChange={([v]) => onChange({ volume: v / 100 })} aria-label="음량" />
          </div>
          <Row label="메트로놈" hint="박마다 작게 똑딱 (센박은 높은 소리)" icon="icon-metronome">
            <Switch checked={settings.metronome} onCheckedChange={(v) => onChange({ metronome: v })} aria-label="메트로놈" />
          </Row>
          <Row label="조작 방식" hint="제스처: 밀기 이동 · 톡 회전 · 아래로 휙 떨어뜨리기 · 위로 휙 보관">
            <Segmented
              value={settings.controls}
              onChange={(v) => onChange({ controls: v })}
              options={[
                { v: 'buttons', label: '버튼' },
                { v: 'gestures', label: '제스처' },
                { v: 'both', label: '둘 다' },
              ]}
            />
          </Row>
          <Row label="⟲ 반시계 회전 버튼" hint="두 손가락 탭이나 Z 키로도 돼요">
            <Switch checked={settings.showCcwButton} onCheckedChange={(v) => onChange({ showCcwButton: v })} aria-label="반시계 회전 버튼 보이기" />
          </Row>
          <Row label="고스트 음표 미리보기" hint="떨어질 자리에 생길 음표를 미리 보여 줘요. 자동 = 스테이지 1~3에서만">
            <Segmented
              value={ghost}
              onChange={(v) => onChange({ ghostPreview: v === 'auto' ? null : v === 'on' })}
              options={[
                { v: 'auto', label: '자동' },
                { v: 'on', label: '켬' },
                { v: 'off', label: '끔' },
              ]}
            />
          </Row>
          <Row label="악보 표기 엄격하게" hint="켜면 4/4 마디 가운데(가상 세로줄)를 넘는 음을 모두 나눠 붙임줄로 적어요">
            <Switch checked={settings.strictNotation} onCheckedChange={(v) => onChange({ strictNotation: v })} aria-label="악보 표기 엄격하게" />
          </Row>
        </div>
      </DialogContent>
    </Dialog>
  );
}
