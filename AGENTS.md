# Founden MCP Server

Build and run a real software company through any AI agent. One API key, no browser required.

## What This Server Does

Founden turns a plain-language description into a deployed company: a marketing website, a customer app with auth and billing, and an internal admin dashboard. This MCP server lets your agent start a build, check its progress, send follow-up instructions, and stop it, all over one connection. Builds run in the cloud and deploy automatically.

## Available Tools

| Tool | Input | Output |
|------|-------|--------|
| build_company | prompt (string, required), company_id (string, optional) | execution_id, company_id, status, and a stream URL for live progress |
| get_build | execution_id (string, required) | current build status and, once ready, the live preview URL |
| message_build | execution_id (string, required), prompt (string, required) | acknowledgment; the follow-up instruction ships to the running build |
| stop_build | execution_id (string, required) | confirmation that the build was stopped (committed work is saved) |

Progress also streams as Server-Sent Events at `/v1/builds/{execution_id}/stream` (events: build_step, build_complete, build_done, orphaned_build, build_error).

## Credits

1 credit per build. Follow-up messages within an in-progress build are free. Reading status and streaming progress are free.

## Authentication

Requires environment variable: `FOUNDEN_API_KEY` (an `omk_` key that works across every O-mega product).
Get a key at: https://founden.ai/app/build/api

## Installation

```bash
npx founden-mcp
```

## Configuration (Claude Desktop / Cursor / VS Code)

```json
{
  "mcpServers": {
    "founden": {
      "command": "npx",
      "args": ["-y", "founden-mcp"],
      "env": { "FOUNDEN_API_KEY": "your_key_here" }
    }
  }
}
```

## Links

- Website: https://founden.ai
- API + MCP docs: https://founden.ai/mcp
- API reference: https://founden.ai/docs/api
- OpenAPI spec: https://founden.ai/v1/openapi.json?product=founden
