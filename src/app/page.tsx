import Link from 'next/link';
import { LiquidCursor } from '@/components/liquid-cursor';
import { CrtTerminal } from '@/components/crt-terminal';
import { IntegrationTabs } from '@/components/integration-tabs';
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
            the control layer
            <br />
            between AI agents
            <br />
            and <span className="ital">money</span>
          </h1>

          <p className="sub">
            Every payment an AI agent tries to make passes through Velos first. It checks your
            policies, then approves it, denies it, or asks a human — and can decline the charge
            at the card network itself. Every decision logged.
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
            <span className="tag">02 / Card Enforcement</span>
            <h3>Declined at the network</h3>
            <p>
              Each agent holds a Velos-issued virtual card. Every charge hits the policy gate in
              real time — out-of-policy spend is declined before the money moves, even if the
              agent never asked.
            </p>
          </div>
          <div className="card">
            <span className="tag">03 / Human Approvals</span>
            <h3>Yes from anywhere</h3>
            <p>
              Escalated spends wait for a human. Approve from the dashboard — or right inside
              Claude Code or Cursor, without leaving the chat. Both write the same audit record.
            </p>
          </div>
          <div className="card">
            <span className="tag">04 / Receipts &amp; Reasons</span>
            <h3>Every decision has a why</h3>
            <p>
              Each verdict is recorded with a plain-English explanation of the rule that fired.
              When finance asks &quot;what did the agents buy in March?&quot; — one query answers.
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
            When it needs a human, the request waits — approve it from the dashboard, or right
            inside the agent itself.
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

      <section className="enforce" data-cursor="dark">
        <div className="enforce-inner">
          <div className="features-label">the airtight part</div>
          <h2>
            asking nicely is optional.
            <br />
            <em>the card isn&apos;t.</em>
          </h2>
          <p className="enforce-lead">
            Each agent spends on a Velos-issued virtual card — never a raw company card. When a
            charge hits the card network, Velos answers in the authorization window: matched to a
            pre-approved request, it goes through. No matching intent, over budget, wrong vendor —
            <b> declined before any money moves</b>. A rogue or jailbroken agent can&apos;t spend
            around the policy, because the policy holds the card.
          </p>
          <div className="enforce-steps">
            <div className="estep">
              <span className="enum">1</span>
              <h4>agent asks</h4>
              <p>
                <span className="mono-note-dark">evaluate_spend</span> — Velos approves the intent
                against your policy.
              </p>
            </div>
            <div className="estep">
              <span className="enum">2</span>
              <h4>card charges</h4>
              <p>
                The real charge hits the network. Velos matches it to the approved intent in the
                authorization window.
              </p>
            </div>
            <div className="estep">
              <span className="enum">3</span>
              <h4>gate decides</h4>
              <p>
                Matched → authorized. Unmatched or out of policy → <b>declined at the network</b>,
                logged, and flagged.
              </p>
            </div>
          </div>
          <p className="enforce-note">
            Live on real Stripe test authorizations today — rolling out with design partners.
          </p>
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
          it asks Velos before it spends, and you approve escalations without leaving the chat. No
          SDK, no glue code.
        </p>
        <IntegrationTabs />
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
