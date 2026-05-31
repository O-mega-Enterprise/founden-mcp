# founden-mcp

MCP server for [Founden](https://founden.ai). Build and iterate on a real software company through any MCP-compatible AI agent (Claude Desktop, Cursor, VS Code, ChatGPT), without keeping a browser open. Describe the business; Founden builds it in the cloud and returns a live preview URL.

## Install

Claude Desktop / Cursor (`mcp.json`):

```json
{
  "mcpServers": {
    "founden": {
      "command": "npx",
      "args": ["-y", "founden-mcp"],
      "env": { "FOUNDEN_API_KEY": "omk_your_key" }
    }
  }
}
```

Get your API key at https://founden.ai/app/build. One `omk_` key works across all O-mega products (Founden, Suprsonic, Suprbrowser).

## Tools

| Tool | Description |
|------|-------------|
| `build_company(prompt, company_id?)` | Start (or continue, on your default company) a build from a plain-language description. Returns an `execution_id`. Costs 1 credit. |
| `get_build(execution_id)` | Get build status and the live preview URL. |
| `message_build(execution_id, prompt)` | Send a follow-up instruction to a running build (free within a build). |

## Example

```
build_company: "Build a booking site for my dental clinic with online payments"
  -> { execution_id: "...", company_id: "...", status: "running", stream_url: "..." }

get_build: "<execution_id>"
  -> { status: "completed", preview_url: "https://...vercel.app" }

message_build: "<execution_id>", "add a contact form on the homepage"
  -> { status: "accepted" }
```

## Remote HTTP transport

```bash
FOUNDEN_API_KEY=omk_... npx founden-mcp --http --port 3100
```

## License

MIT
