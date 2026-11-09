import type { ArktypeJsonSchemaAdapter } from "@tmcp/adapter-arktype";
import type { McpServer } from "tmcp";
import type { JsonSchemaAdapter } from "tmcp/adapter";

type ArktypeSchema = ArktypeJsonSchemaAdapter extends JsonSchemaAdapter<infer Schema> ? Schema : never;

/** The MCP server with ArkType schemas, which every tool registers on. */
export type ArchiveServer = McpServer<ArktypeSchema>;
