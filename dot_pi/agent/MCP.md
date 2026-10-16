# Pi MCP Reference

Official documentation:

https://pi.dev/docs/latest/mcp

Global configuration:

```text
~/.pi/agent/mcp.json
```

Project-specific configuration:

```text
.pi/mcp.json
```

Prefer the global configuration for personal MCP servers, especially servers involving credentials. Use project configuration only for MCP servers specifically required by a trusted project.

## Basic commands

List configured servers:

```sh
pi mcp list
```

Add a stdio MCP:

```sh
pi mcp add <name> -- <command> <args...>
```

Example syntax:

```sh
pi mcp add filesystem -- npx -y @modelcontextprotocol/server-filesystem .
```

Add an HTTP MCP:

```sh
pi mcp add <name> --url <https://server.example/mcp>
```

Add to the current project's `.pi/mcp.json` instead of the global configuration:

```sh
pi mcp add -l <name> -- <command> <args...>
```

Remove:

```sh
pi mcp remove <name>
```

Check configuration and connections:

```sh
pi mcp list
```

OAuth login/logout:

```sh
pi mcp login <name>
pi mcp logout <name>
```

Inside Pi:

```text
/mcp
```

opens the MCP server manager.

After adding or changing an MCP server in an existing Pi session, run:

```text
/reload
```

or start a new Pi session.

## Configuration shapes

stdio MCP:

```json
{
  "mcpServers": {
    "name": {
      "command": "executable",
      "args": ["arg1", "arg2"]
    }
  }
}
```

Optional stdio fields include:

```text
env
cwd
timeout
enabled
exposure
```

HTTP MCP:

```json
{
  "mcpServers": {
    "name": {
      "url": "https://example.com/mcp"
    }
  }
}
```

Optional HTTP fields include:

```text
headers
oauth
timeout
enabled
exposure
```

Do not use legacy SSE endpoints. Pi supports stdio and streamable HTTP MCP transports.

## Secrets

Do not put secrets directly into `mcp.json`.

Reference environment variables:

```json
{
  "headers": {
    "Authorization": "Bearer ${MY_TOKEN}"
  }
}
```

Pi also supports command-derived values using `!command`.

## Exposure

The default MCP exposure is:

```text
codemode
```

Other supported modes include:

```text
codemode-deferred
deferred
direct
hidden
```

Normally leave exposure at its default unless there is a reason to change it.

## Important rules

Server names may contain only letters, digits, `_`, and `-`.

Pi exposes MCP tools using names shaped like:

```text
mcp__<server>__<tool>
```

For stdio MCPs, `command` must contain one executable and `args` must be a separate JSON array. Do not put the entire shell command into `command`.

Project MCP configuration overrides a global MCP with the same server name.

Project `.pi/mcp.json` is only loaded after the project is trusted because stdio MCP servers can execute commands.

Use:

```sh
pi mcp list
```

after adding a server. It connects to enabled servers and reports their tools and connection/configuration errors.

OAuth credentials are managed by Pi separately; do not manually put OAuth access tokens into this reference document.

Do not install `pi-mcp-adapter` or another extension merely to get MCP functionality. Modern Pi has native MCP support. An extension that registers `/mcp`, such as `pi-mcp-adapter`, can override Pi's built-in MCP functionality.

When uncertain about MCP configuration or when adding a new server, consult the current official documentation first:

https://pi.dev/docs/latest/mcp
