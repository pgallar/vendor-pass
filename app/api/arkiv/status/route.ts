import { readSyncState } from '@/lib/arkiv/sync-state';
import { getStoreSource } from '@/lib/arkiv/validations';

export async function GET() {
  const state = readSyncState();
  const source = getStoreSource();
  const stale =
    state?.completedAt != null &&
    Date.now() - new Date(state.completedAt).getTime() > 25 * 60 * 60 * 1000;

  return Response.json({
    source,
    lastSync: state,
    stale,
  });
}
