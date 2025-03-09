#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { OpenAPIV3 } from "openapi-types";
import axios from "axios";
import { readFile } from "fs/promises";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema, // Changed from ExecuteToolRequestSchema
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

interface OpenAPIMCPServerConfig {
  name: string;
  version: string;
  apiBaseUrl: string;
  openApiSpec: OpenAPIV3.Document | string;
  headers?: Record<string, string>;
}

function loadConfig(): OpenAPIMCPServerConfig {
  const argv = yargs(hideBin(process.argv))
    .version(false)
    .option("serverVersion", {
      alias: "v",
      type: "string",
      description: "Server version",
      default: "1.0.1"
    })
    .parseSync();

  const apiBaseUrl = "https://api.elevenlabs.io";
  const openApiSpec = "https://api.elevenlabs.io/openapi.json";
  const serverName = "elevenlabs-mcp-server";
  
  // Get API key from environment variable only (not from command line for security)
  const headers: Record<string, string> = {};
  if (process.env.ELEVENLABS_API_KEY) {
    headers["xi-api-key"] = process.env.ELEVENLABS_API_KEY;
  } else {
    console.error("Warning: ELEVENLABS_API_KEY environment variable not set. API calls will likely fail.");
  }
  headers["Content-Type"] = "application/json";

  const version = argv.serverVersion as string || process.env.SERVER_VERSION || "1.0.1";

  return {
    name: serverName,
    version,
    apiBaseUrl,
    openApiSpec,
    headers,
  };
}

// Add a more specific type for the input schema
interface ToolInputSchema {
  type: string;
  properties: Record<string, any>;
  required?: string[];
}

// Extend the Tool interface to use our more specific input schema
interface ExtendedTool extends Omit<Tool, 'inputSchema'> {
  inputSchema: ToolInputSchema;
}

class OpenAPIMCPServer {
  private server: Server;
  private config: OpenAPIMCPServerConfig;

  private tools: Map<string, Tool> = new Map();

  constructor(config: OpenAPIMCPServerConfig) {
    this.config = config;
    this.server = new Server({
      name: config.name,
      version: config.version,
    });

    this.initializeHandlers();
  }

  private async loadOpenAPISpec(): Promise<OpenAPIV3.Document> {
    if (typeof this.config.openApiSpec === "string") {
      try {
        if (this.config.openApiSpec.startsWith("http")) {
          // Load from URL
          const response = await axios.get(this.config.openApiSpec);
          return response.data as OpenAPIV3.Document;
        } else {
          // Load from local file
          try {
            const content = await readFile(this.config.openApiSpec, "utf-8");
            return JSON.parse(content) as OpenAPIV3.Document;
          } catch (error: any) {
            console.error(`Failed to read OpenAPI spec from ${this.config.openApiSpec}:`, error);
            throw new Error(`Failed to load OpenAPI spec: ${error.message}`);
          }
        }
      } catch (error) {
        console.error("Failed to load OpenAPI spec:", error);
        throw error;
      }
    }
    return this.config.openApiSpec as OpenAPIV3.Document;
  }

  private async parseOpenAPISpec(): Promise<void> {
    const spec = await this.loadOpenAPISpec();

    for (const [path, pathItem] of Object.entries(spec.paths)) {
      if (!pathItem) continue;

      for (const [method, operation] of Object.entries(pathItem)) {
        if (method === "parameters" || !operation) continue;

        const op = operation as OpenAPIV3.OperationObject;
        const cleanPath = path.replace(/^\//, "");
        const toolId = `${method.toUpperCase()}-${cleanPath}`.replace(
          /[^a-zA-Z0-9-]/g,
          "-",
        );

        // Create a more concise name by using the summary or a simplified path
        let toolName = op.summary || '';
        if (!toolName) {
          // Create a clean name from the path and method
          toolName = `${method.toUpperCase()}_${cleanPath
            .split('/')
            .join('_')}`; // Use underscores instead of spaces
        }
        
        // Clean the name to only allow valid characters
        toolName = toolName
          .replace(/[^a-zA-Z0-9_-]/g, '_') // Replace invalid chars with underscore
          .replace(/_{2,}/g, '_'); // Replace multiple consecutive underscores with single one
        
        // Ensure length limit
        if (toolName.length > 64) {
          toolName = toolName.substring(0, 64);
        }

        const tool: ExtendedTool = {
          name: toolName,
          description:
            op.description ||
            `Make a ${method.toUpperCase()} request to ${path}`,
          inputSchema: {
            type: "object",
            properties: {},
          },
        };

        // Store the mapping between name and ID for reverse lookup
        console.error(`Registering tool: ${toolId} (${tool.name})`);

        // Add parameters from operation
        if (op.parameters) {
          for (const param of op.parameters) {
            if ("name" in param && "in" in param) {
              const paramSchema = param.schema as OpenAPIV3.SchemaObject;
              tool.inputSchema.properties[param.name] = {
                type: paramSchema.type || "string",
                description: param.description || `${param.name} parameter`,
              };
              if (param.required) {
                if (!tool.inputSchema.required) {
                  tool.inputSchema.required = [];
                }
                tool.inputSchema.required.push(param.name);
              }
            }
          }
        }
        this.tools.set(toolId, tool as Tool);
      }
    }
  }

  private initializeHandlers(): void {
    // Handle tool listing
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: Array.from(this.tools.values()),
      };
    });

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { id, name, arguments: params } = request.params;

      console.error("Received request:", request.params);
      console.error("Using parameters from arguments:", params);

      // Find tool by ID or name
      let tool: Tool | undefined;
      let toolId: string | undefined;

      if (id) {
        // Fix the trim() error by ensuring id is a string
        toolId = typeof id === 'string' ? id.trim() : String(id);
        tool = this.tools.get(toolId);
      } else if (name) {
        // Search for tool by name
        for (const [tid, t] of this.tools.entries()) {
          if (t.name === name) {
            tool = t;
            toolId = tid;
            break;
          }
        }
      }

      if (!tool || !toolId) {
        console.error(
          `Available tools: ${Array.from(this.tools.entries())
            .map(([id, t]) => `${id} (${t.name})`)
            .join(", ")}`,
        );
        throw new Error(`Tool not found: ${id || name}`);
      }

      console.error(`Executing tool: ${toolId} (${tool.name})`);

      try {
        // Extract method and path from tool ID
        const [method, ...pathParts] = toolId.split("-");
        const path = "/" + pathParts.join("/").replace(/-/g, "/");

        // Ensure base URL ends with slash for proper joining
        const baseUrl = this.config.apiBaseUrl.endsWith("/")
          ? this.config.apiBaseUrl
          : `${this.config.apiBaseUrl}/`;

        // Remove leading slash from path to avoid double slashes
        const cleanPath = path.startsWith("/") ? path.slice(1) : path;

        // Construct the full URL
        const url = new URL(cleanPath, baseUrl).toString();

        //console.error(`Making API request: ${method.toLowerCase()} ${url}`);
        //console.error(`Base URL: ${baseUrl}`);
        //console.error(`Path: ${cleanPath}`);
        //console.error(`Raw parameters:`, params);
        //console.error(`Request headers:`, this.config.headers);

        // Prepare request configuration
        const config: any = {
          method: method.toLowerCase(),
          url: url,
          headers: this.config.headers,
        };

        // Handle different parameter types based on HTTP method
        if (method.toLowerCase() === "get") {
          // For GET requests, ensure parameters are properly structured
          if (params && typeof params === "object") {
            // Handle array parameters properly
            const queryParams: Record<string, string> = {};
            for (const [key, value] of Object.entries(params)) {
              if (Array.isArray(value)) {
                // Join array values with commas for query params
                queryParams[key] = value.join(",");
              } else if (value !== undefined && value !== null) {
                // Convert other values to strings
                queryParams[key] = String(value);
              }
            }
            config.params = queryParams;
          }
        } else {
          // For POST, PUT, PATCH - send as body
          config.data = params;
        }

        console.error(`Processed parameters:`, config.params || config.data);

        console.error("Final request config:", config);

        try {
          const response = await axios(config);
          console.error("Response status:", response.status);
          console.error("Response headers:", response.headers);
          console.error("Response data:", response.data);
          return {
            content: [{
              type: "text",
              text: JSON.stringify(response.data, null, 2)
            }]
          };
        } catch (error) {
          if (axios.isAxiosError(error)) {
            console.error("Request failed:", {
              status: error.response?.status,
              statusText: error.response?.statusText,
              data: error.response?.data,
              headers: error.response?.headers,
            });
            throw new Error(
              `API request failed: ${error.message} - ${JSON.stringify(error.response?.data)}`,
            );
          }
          throw error;
        }

      } catch (error) {
        if (axios.isAxiosError(error)) {
          throw new Error(`API request failed: ${error.message}`);
        }
        throw error;
      }
    });
  }

  async start(): Promise<void> {
    await this.parseOpenAPISpec();
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("OpenAPI MCP Server running on stdio");
  }
}

async function main(): Promise<void> {
  try {
    const config = loadConfig();
    const server = new OpenAPIMCPServer(config);
    await server.start();
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

main();

export { OpenAPIMCPServer, loadConfig };