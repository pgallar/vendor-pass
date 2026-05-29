import { AsyncLocalStorage } from 'async_hooks';
import type { SupabaseClient } from '@supabase/supabase-js';

export type McpRequestContext = {
  userId: string;
  supabase: SupabaseClient;
};

const storage = new AsyncLocalStorage<McpRequestContext>();

export function runWithMcpContext<T>(ctx: McpRequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function getMcpContext(): McpRequestContext {
  const ctx = storage.getStore();
  if (!ctx) throw new Error('Contexto MCP no disponible');
  return ctx;
}
