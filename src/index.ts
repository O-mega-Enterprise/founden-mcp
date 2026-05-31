#!/usr/bin/env node
/**
 * Founden MCP Server
 *
 * Gives any MCP-compatible AI agent (Claude Desktop, Cursor, VS Code, ChatGPT, etc.)
 * the ability to build and run a real company through the Founden API, without the
 * user keeping a browser open.
 *
 * CAPABILITIES are auto-generated from apps/shared/data/founden-capabilities.json
 * by scripts/generate_session_artifacts.py --product founden. Do NOT edit
 * generated-capabilities.ts manually.
 *
 * Usage (local stdio, for Claude Desktop / Cursor):
 *   FOUNDEN_API_KEY=omk_... npx founden-mcp
 *
 * Usage (remote HTTP, for Claude API / programmatic agents):
 *   FOUNDEN_API_KEY=omk_... npx founden-mcp --http --port 3300
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { CAPABILITIES } from "./generated-capabilities.js";

const API_KEY = process.env.FOUNDEN_API_KEY || "";
const BASE_URL = process.env.FOUNDEN_BASE_URL || "https://founden.ai";

// ---------------------------------------------------------------------------
// HTTP caller: makes requests to the Founden REST API
// ---------------------------------------------------------------------------

async function callFounden(
  method: string,
  path: string,
  params: Record<string, unknown>,
): Promise<CallToolResult> {
  if (!API_KEY) {
    return {
      content: [{ type: "text", text: "Error: FOUNDEN_API_KEY environment variable is not set. Get your key at https://founden.ai/app/build" }],
      isError: true,
    };
  }

  try {
    // Substitute path parameters (e.g. /v1/builds/{execution_id})
    let resolvedPath = path;
    const pathParams = path.match(/\{(\w+)\}/g) || [];
    for (const pp of pathParams) {
      const paramName = pp.slice(1, -1);
      const value = params[paramName];
      if (!value) {
        return {
          content: [{ type: "text", text: `Error: missing required path parameter '${paramName}'` }],
          isError: true,
        };
      }
      resolvedPath = resolvedPath.replace(pp, String(value));
      delete params[paramName];
    }

    const url = `${BASE_URL}${resolvedPath}`;
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    };
    const fetchOpts: RequestInit = { method: method.toUpperCase(), headers };

    if (method === "GET" || method === "DELETE") {
      const queryParams = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) queryParams.set(k, String(v));
      }
      const qs = queryParams.toString();
      const resp = await fetch(qs ? `${url}?${qs}` : url, fetchOpts);
      return handleResponse(resp);
    }

    // POST/PATCH/PUT: send JSON body. Parse any string values that are actually
    // JSON objects/arrays (MCP schemas use z.string() for complex params).
    const parsedParams: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(params)) {
      if (typeof v === "string") {
        try {
          const parsed = JSON.parse(v);
          if (typeof parsed === "object" && parsed !== null) {
            parsedParams[k] = parsed;
            continue;
          }
        } catch {
          // not JSON, keep as string
        }
      }
      parsedParams[k] = v;
    }
    fetchOpts.body = JSON.stringify(parsedParams);
    const resp = await fetch(url, fetchOpts);
    return handleResponse(resp);
  } catch (err) {
    return {
      content: [{ type: "text", text: `Network error: ${err instanceof Error ? err.message : String(err)}` }],
      isError: true,
    };
  }
}

async function handleResponse(resp: Response): Promise<CallToolResult> {
  const result = await resp.json() as any;

  // Handle non-envelope responses (401, 429, etc.)
  if (result.detail && result.success === undefined) {
    const msg = typeof result.detail === "object"
      ? (result.detail.title || result.detail.detail || JSON.stringify(result.detail))
      : String(result.detail);
    return {
      content: [{ type: "text", text: `Error (HTTP ${resp.status}): ${msg}` }],
      isError: true,
    };
  }

  if (result.success === false) {
    const errMsg = result.error?.detail || result.error?.title || "Request failed";
    return {
      content: [{ type: "text", text: `Error: ${errMsg}` }],
      isError: true,
    };
  }

  const data = result.data ?? result;
  const text = JSON.stringify(data, null, 2);
  const credits = result.credits_used ?? 0;
  const meta = credits > 0 ? `\n\n[${credits} credits used]` : "";
  return { content: [{ type: "text", text: text + meta }] };
}

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

function createServer(): McpServer {
  const server = new McpServer(
    { name: "founden", version: "0.1.0" },
    { capabilities: { logging: {} } },
  );

  // Register each capability as an MCP tool (from generated definitions)
  for (const cap of CAPABILITIES) {
    server.registerTool(
      cap.name,
      {
        description: cap.description,
        inputSchema: cap.inputSchema as any,
      },
      async (args: any): Promise<CallToolResult> => {
        return callFounden(cap.method, cap.path, { ...(args as Record<string, unknown>) });
      },
    );
  }

  return server;
}

// ---------------------------------------------------------------------------
// Entry point (stdio default; --http for remote). Same transport boilerplate
// as the Suprsonic and Suprbrowser MCP servers.
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--http")) {
    const { default: express } = await import("express");
    const { StreamableHTTPServerTransport } = await import(
      "@modelcontextprotocol/sdk/server/streamableHttp.js"
    );
    const { randomUUID } = await import("node:crypto");

    const app = express();
    app.use(express.json());

    const transports = new Map<string, InstanceType<typeof StreamableHTTPServerTransport>>();

    app.post("/mcp", async (req, res) => {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      if (!sessionId || !transports.has(sessionId)) {
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID() });
        transport.onclose = () => {
          if (transport.sessionId) transports.delete(transport.sessionId);
        };
        const server = createServer();
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
        if (transport.sessionId) transports.set(transport.sessionId, transport);
        return;
      }
      await transports.get(sessionId)!.handleRequest(req, res, req.body);
    });

    app.get("/mcp", async (req, res) => {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      if (!sessionId || !transports.has(sessionId)) {
        res.status(400).json({ error: "Invalid session" });
        return;
      }
      await transports.get(sessionId)!.handleRequest(req, res);
    });

    app.delete("/mcp", async (req, res) => {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      if (!sessionId || !transports.has(sessionId)) {
        res.status(400).json({ error: "Invalid session" });
        return;
      }
      await transports.get(sessionId)!.handleRequest(req, res);
      transports.delete(sessionId);
    });

    const port = parseInt(args[args.indexOf("--port") + 1] || "3300", 10);
    app.listen(port, () => {
      console.log(`Founden MCP server (HTTP) running at http://localhost:${port}/mcp`);
    });
  } else {
    const server = createServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }
}

main().catch(console.error);
