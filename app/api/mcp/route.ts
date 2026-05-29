import { handleVendorPassMcp } from '@/lib/mcp/handler';

export const runtime = 'nodejs';
export const maxDuration = 60;

export const GET = handleVendorPassMcp;
export const POST = handleVendorPassMcp;
export const DELETE = handleVendorPassMcp;
