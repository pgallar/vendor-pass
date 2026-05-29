import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { requireApiKey } from '@/lib/api-keys/auth';
import { runWithMcpContext } from '@/lib/mcp/context';
import { registerVendorPassMcpTools } from '@/lib/mcp/register-tools';

/** Maneja una solicitud MCP (Streamable HTTP) autenticada con API key. */
export async function handleVendorPassMcp(req: Request): Promise<Response> {
  const auth = await requireApiKey(req);
  if (auth.error) return auth.error;

  return runWithMcpContext({ userId: auth.userId, supabase: auth.supabase }, async () => {
    const server = new McpServer({ name: 'vendorpass', version: '0.1.0' });
    registerVendorPassMcpTools(server);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    await server.connect(transport);
    return transport.handleRequest(req);
  });
}
