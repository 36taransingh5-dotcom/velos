'use client';

import { useState } from 'react';

const ENDPOINT = 'https://velos-chi.vercel.app/api/mcp';

interface Integration {
  id: string;
  label: string;
  file?: string;
  code: string;
}

const integrations: Integration[] = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    file: 'run in your terminal',
    code: `claude mcp add --transport http velos \\
  ${ENDPOINT} \\
  --header "Authorization: Bearer vk_..."`,
  },
  {
    id: 'cursor',
    label: 'Cursor',
    file: '.cursor/mcp.json',
    code: `{
  "mcpServers": {
    "velos": {
      "url": "${ENDPOINT}",
      "headers": { "Authorization": "Bearer vk_..." }
    }
  }
}`,
  },
  {
    id: 'codex',
    label: 'Codex',
    file: '~/.codex/config.toml',
    code: `[mcp_servers.velos]
command = "npx"
args = ["-y", "mcp-remote", "${ENDPOINT}", "--header", "Authorization: Bearer vk_..."]`,
  },
  {
    id: 'claude-desktop',
    label: 'Claude Desktop',
    file: 'claude_desktop_config.json',
    code: `{
  "mcpServers": {
    "velos": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "${ENDPOINT}", "--header", "Authorization: Bearer vk_..."]
    }
  }
}`,
  },
  {
    id: 'mcp',
    label: 'any MCP client',
    file: 'streamable HTTP transport',
    code: `Endpoint:  ${ENDPOINT}
Auth:      Authorization: Bearer vk_...
Tools:     evaluate_spend(agent, vendor, amount, reason?)
           check_decision(id)
           list_pending_approvals()
           resolve_decision(id, verdict)   # human sign-off, in-chat`,
  },
];

export function IntegrationTabs() {
  const [activeId, setActiveId] = useState(integrations[0].id);
  const [copied, setCopied] = useState(false);
  const active = integrations.find((i) => i.id === activeId)!;

  async function copy() {
    try {
      await navigator.clipboard.writeText(active.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — no-op */
    }
  }

  return (
    <>
      <div className="clients" role="tablist" aria-label="MCP clients">
        {integrations.map((i) => (
          <button
            key={i.id}
            type="button"
            role="tab"
            aria-selected={i.id === activeId}
            className={`client-chip${i.id === activeId ? ' active' : ''}`}
            onClick={() => {
              setActiveId(i.id);
              setCopied(false);
            }}
          >
            <span className="dot" />
            {i.label}
          </button>
        ))}
      </div>

      <div className="codeblock integration-code">
        <button type="button" className="copy-btn" onClick={copy}>
          {copied ? 'copied ✓' : 'copy'}
        </button>
        {active.file && <div className="code-file"># {active.file}</div>}
        <pre>{active.code}</pre>
      </div>
    </>
  );
}
