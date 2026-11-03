'use client';
// 로마 숫자 글자 — 화면 글꼴(Jua)에는 Ⅰ·Ⅳ·Ⅴ 글자가 없어서(에셋 README) 대신 쓰이는 글꼴에서는 Ⅰ 이 막대(|)처럼 보인다.
// 그래서 화면 글자 속 로마 숫자는 세리프 있는 라틴 글자(I·IV·V, 단조 i·iv)로 바꿔 그린다. 데이터·문서의 표기는 그대로 Ⅰ·Ⅳ·Ⅴ.
import { Fragment } from 'react';

const MAP: Record<string, string> = { 'Ⅰ': 'I', 'Ⅳ': 'IV', 'Ⅴ': 'V', 'ⅰ': 'i', 'ⅳ': 'iv' };
const RE = /([ⅠⅣⅤⅰⅳ]7?)/;

export function RText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(RE);
  return (
    <span className={className}>
      {parts.map((p, i) =>
        RE.test(p) ? (
          <span key={i} className="cm-roman">
            {p.replace(/[ⅠⅣⅤⅰⅳ]/, (m) => MAP[m])}
          </span>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </span>
  );
}

/** 글자만 필요할 때(토스트 등): Ⅰ → I */
export function romanAscii(text: string): string {
  return text.replace(/[ⅠⅣⅤⅰⅳ]/g, (m) => MAP[m]);
}
