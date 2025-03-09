# OpenAPI MCP Server

A Model Context Protocol (MCP) server that exposes OpenAPI endpoints as MCP resources. This server allows Large Language Models to discover and interact with REST APIs defined by OpenAPI specifications through the MCP protocol.

## Quick Start

You do not need to clone this repository to use this MCP server. You can simply configure it in Claude Desktop:

1. Locate or create your Claude Desktop configuration file:
   - On macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

2. Add the following configuration to enable the OpenAPI MCP server:

```json
{
  "mcpServers": {
    "openapi": {
      "command": "npx",
      "args": ["-y", "@angelogiacco/elevenlabs-mcp-server"],
      "env": {
        "ELEVENLABS_API_KEY": "your api key goes here"
      }
    }
  }
}
```

## ElevenLabs API Configuration

This MCP server is pre-configured to work with the ElevenLabs API. To use it:

1. Locate or create your Claude Desktop configuration file:
   - On macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

2. Add the following configuration:

```json
{
  "mcpServers": {
    "elevenlabs": {
      "command": "npx",
      "args": ["-y", "@angelogiacco/elevenlabs-mcp-server"],
      "env": {
        "ELEVENLABS_API_KEY": "your-elevenlabs-api-key-here"
      }
    }
  }
}
```

3. Replace `your-elevenlabs-api-key-here` with your actual ElevenLabs API key.

The server is pre-configured with:
- API Base URL: https://api.elevenlabs.io/
- OpenAPI Spec: Local openapi.json file
- Server Name: elevenlabs-mcp-server

### Available ElevenLabs API Endpoints

The MCP server exposes all ElevenLabs API endpoints available in the openapi spec. 

To add new endpoints, just update the openapi spec.

## Development Tools

This project includes several development tools to make your workflow easier:

### Building

- `npm run build` - Builds the TypeScript source
- `npm run clean` - Removes build artifacts
- `npm run typecheck` - Runs TypeScript type checking

### Development Mode

- `npm run dev` - Watches source files and rebuilds on changes
- `npm run inspect-watch` - Runs the inspector with auto-reload on changes

### Code Quality

- `npm run lint` - Runs ESLint
- `npm run typecheck` - Verifies TypeScript types

## Configuration

The server can be configured through environment variables or command line arguments:

## Development Workflow

1. Start the development environment:
```bash
npm run inspect-watch
```

2. Make changes to the TypeScript files in `src/`
3. The server will automatically rebuild and restart
4. Use the MCP Inspector UI to test your changes

## Debugging

The server outputs debug logs to stderr. To see these logs:

1. In development mode:
   - Logs appear in the terminal running `inspect-watch`
   
2. When running directly:
   ```bash
   npm run inspect 2>debug.log
   ```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting:
   ```bash
   npm run typecheck
   npm run lint
   ```
5. Submit a pull request

## License

MIT