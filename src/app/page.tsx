import Link from 'next/link';
import { LiquidCursor } from '@/components/liquid-cursor';
import { CrtTerminal } from '@/components/crt-terminal';
import './landing.css';

export default function LandingPage() {
  return (
    <>
      <LiquidCursor />

      <section className="hero" data-cursor="dark">
        <div className="cloud c1" />
        <div className="cloud c2" />
        <div className="cloud c3" />
        <div className="cloud c4" />

        <nav className="nav">
          <span className="logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/velos-mark.png" alt="Velos" className="logo-mark" />
            velos
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '20px' }}>
            <Link className="nav-login" href="/sign-in">
              log in
            </Link>
            <Link className="nav-cta" href="/sign-up">
              get access
            </Link>
          </span>
        </nav>

        <div className="hero-inner">
          <div className="trustline">
            Built for{' '}
            <span className="trust-badge">
              <span className="dot" />
              AI-native
            </span>{' '}
            companies
          </div>

          <h1 className="chrome">
            the internet&apos;s
            <br />
            <span className="ital">calmest</span> way to let
            <br />
            AI agents spend
          </h1>

          <p className="sub">
            Agents can already write code, research and automate work. Companies still don&apos;t
            trust them with money. Velos decides, explains, and keeps the receipts.
          </p>

          <Link className="cta" href="/sign-up">
            Start Free <span className="arrow">→</span>
          </Link>

          <CrtTerminal />
        </div>
      </section>

      <div className="intro" data-cursor="light">
        we&apos;re velos — a policy engine for agent spending.
        <br />
        built for <span className="hl">trust &amp; accountability</span>
      </div>

      <section className="features" data-cursor="light">
        <div className="features-label">what velos does</div>
        <h2>
          every dollar an agent spends,
          <br />
          <em>decided, explained, recorded</em>
        </h2>
        <div className="grid">
          <div className="card">
            <span className="tag">01 / Policy Engine</span>
            <h3>Rules before receipts</h3>
            <p>
              Vendor allowlists, monthly budgets, auto-approve thresholds. Your agent asks before
              it spends — Velos answers in milliseconds: approved, denied, or send a human.
            </p>
          </div>
          <div className="card">
            <span className="tag">02 / Explainability</span>
            <h3>Every decision has a why</h3>
            <p>
              No black boxes. Each verdict ships with a plain-English explanation of the exact rule
              that fired — the vendor, the budget math, the threshold.
            </p>
          </div>
          <div className="card">
            <span className="tag">03 / Audit Log</span>
            <h3>Receipts, forever</h3>
            <p>
              Every request is recorded whether it was approved or not. When finance asks &quot;what
              did the agents buy in March?&quot; — you have the answer in one query.
            </p>
          </div>
        </div>
      </section>

      <section className="code-section" data-cursor="light">
        <div className="code-copy">
          <h2>
            one endpoint.
            <br />
            <em>before</em> the money moves.
          </h2>
          <p>
            Your agent calls <span className="mono-note">POST /api/v1/evaluate</span> before any
            purchase. Velos checks the policy and returns a decision — approved, denied, or held
            for a human — that your payment flow can act on.
          </p>
          <p>
            Within policy, it passes. Against it, Velos declines and flags it in your dashboard.
            When it needs a human, the request waits in the approvals queue until someone taps
            yes.
          </p>
        </div>
        <div className="codeblock">
          <span className="c"># agent wants $42.50 of OpenAI credits</span>
          {'\n'}curl -X POST velos.dev/api/v1/evaluate \{'\n'}
          {'  '}-H &quot;Authorization: Bearer vk_...&quot; \{'\n'}
          {'  '}-d &apos;{'{'}
          {'\n'}
          {'    '}
          <span className="k">&quot;agent&quot;</span>: <span className="s">&quot;research-bot&quot;</span>,
          {'\n'}
          {'    '}
          <span className="k">&quot;vendor&quot;</span>: <span className="s">&quot;OpenAI&quot;</span>,
          {'\n'}
          {'    '}
          <span className="k">&quot;amount&quot;</span>: 42.50{'\n'}
          {'  '}
          {'}'}&apos;{'\n\n'}
          <span className="c"># velos answers, instantly</span>
          {'\n'}
          {'{'}
          {'\n'}
          {'  '}
          <span className="k">&quot;decision&quot;</span>: <span className="s">&quot;approved&quot;</span>,
          {'\n'}
          {'  '}
          <span className="k">&quot;explanation&quot;</span>:{' '}
          <span className="s">
            &quot;Auto-approved: $42.50 is{'\n'}
            {'   '}under the $100 threshold and within{'\n'}
            {'   '}the $2,000 monthly budget.&quot;
          </span>
          {'\n'}
          {'}'}
        </div>
      </section>

      <section className="connect" data-cursor="light">
        <div className="features-label">plug it in</div>
        <h2>
          drop it into the agent
          <br />
          <em>you already use</em>
        </h2>
        <p className="lead">
          Velos ships a native MCP server. Connect Claude Code, Cursor, Codex, or Claude Desktop
          and your agent gets <span className="mono-note">evaluate_spend</span> as a built-in tool —
          it asks Velos before it spends. No SDK, no glue code.
        </p>
        <div className="clients">
          <span className="client-chip">
            <span className="dot" />
            Claude Code
          </span>
          <span className="client-chip">
            <span className="dot" />
            Cursor
          </span>
          <span className="client-chip">
            <span className="dot" />
            Codex
          </span>
          <span className="client-chip">
            <span className="dot" />
            Claude Desktop
          </span>
          <span className="client-chip">
            <span className="dot" />
            any MCP client
          </span>
        </div>
        <div className="codeblock">
          <span className="c"># add velos to claude code</span>
          {'\n'}claude mcp add --transport http velos \{'\n'}
          {'  '}https://velos.dev/api/mcp \{'\n'}
          {'  '}--header <span className="s">&quot;Authorization: Bearer vk_...&quot;</span>
          {'\n\n'}
          <span className="c"># your agent now has evaluate_spend + check_decision</span>
        </div>
      </section>

      <section className="footer-cta" data-cursor="dark" id="access">
        <h2>
          give your agents
          <br />
          an allowance
        </h2>
        <p>Free for 500 decisions a month. No card required.</p>
        <Link className="cta" href="/sign-up">
          Get Early Access <span className="arrow">→</span>
        </Link>
      </section>

      <footer data-cursor="dark">
        <span className="footer-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/velos-mark.png" alt="Velos" className="footer-mark" />
          <b>velos</b>
        </span>{' '}
        · the financial control layer for AI agents · © 2026
      </footer>
    </>
  );
}
