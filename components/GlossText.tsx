"use client";

import {useGloss} from "./GlossProvider";

export function GlossText({ children }: { children: React.ReactNode }) {
  const text = String(children ?? "");
  const { tokenizer, ready, open, close } = useGloss();

  if (!ready || !tokenizer || !text) {
    return <span>{text}</span>;
  }

  const tokens = tokenizer.tokenize(text);

  return (
    <span>
      {tokens.map((t, i) => (
        <span
          key={i}
          onMouseEnter={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            open(t, { x: rect.left, y: rect.top, w: rect.width });
          }}
          onMouseLeave={() => close()}
          className="cursor-help underline decoration-dotted decoration-crimson/50 underline-offset-4"
        >
          {t.surface_form}
        </span>
      ))}
    </span>
  );
}
