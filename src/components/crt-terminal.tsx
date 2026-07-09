'use client';

import { useEffect, useRef } from 'react';

interface Scenario {
  req: string;
  lines: string[];
}

/** Typing demo: cycles the three verdicts on the retro CRT screen. */
const scenarios: Scenario[] = [
  {
    req: '$ velos evaluate --agent research-bot \\\n    --vendor OpenAI --amount 42.50',
    lines: [
      '<span class="dim">checking policy: Default Policy…</span>',
      '<span class="white">decision:</span> <span class="ok">APPROVED ✓</span>',
      '<span class="dim">$42.50 &lt; $100 auto-approve threshold.\nbudget remaining: $1,957.50</span>',
    ],
  },
  {
    req: '$ velos evaluate --agent growth-bot \\\n    --vendor SketchyCo --amount 15.00',
    lines: [
      '<span class="dim">checking policy: Default Policy…</span>',
      '<span class="white">decision:</span> <span class="no">DENIED ✗</span>',
      '<span class="dim">"SketchyCo" is not an allowed vendor.</span>',
    ],
  },
  {
    req: '$ velos evaluate --agent infra-bot \\\n    --vendor Anthropic --amount 500.00',
    lines: [
      '<span class="dim">checking policy: Default Policy…</span>',
      '<span class="white">decision:</span> <span class="hold">HUMAN APPROVAL REQUIRED ◉</span>',
      '<span class="dim">$500 ≥ $100 threshold. within budget —\nescalating to a human.</span>',
    ],
  },
];

export function CrtTerminal() {
  const termRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    let cancelled = false;

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    async function typeText(el: HTMLElement, text: string) {
      for (const ch of text) {
        if (cancelled) return;
        el.textContent += ch;
        await sleep(ch === '\n' ? 120 : 26);
      }
    }

    async function run() {
      let si = 0;
      while (!cancelled) {
        const s = scenarios[si % scenarios.length];
        si++;
        term!.innerHTML = '';
        const reqEl = document.createElement('span');
        term!.appendChild(reqEl);
        const cur = document.createElement('span');
        cur.className = 'cursor';
        term!.appendChild(cur);
        await typeText(reqEl, s.req);
        await sleep(500);
        for (const line of s.lines) {
          if (cancelled) return;
          const div = document.createElement('div');
          div.innerHTML = line;
          term!.insertBefore(div, cur);
          await sleep(650);
        }
        await sleep(3200);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="crt-wrap">
      <div className="crt">
        <div className="crt-screen">
          <div className="term" ref={termRef} />
        </div>
        <div className="crt-controls">
          <div className="vent" />
          <div className="knob" />
          <div className="knob" />
        </div>
      </div>
    </div>
  );
}
