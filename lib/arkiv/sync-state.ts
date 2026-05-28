import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export type SyncState = {
  completedAt: string;
  synced: number;
  failed: number;
};

const STATE_FILE = join(process.cwd(), '.arkiv-last-sync.json');

export function readSyncState(): SyncState | null {
  try {
    if (!existsSync(STATE_FILE)) return null;
    return JSON.parse(readFileSync(STATE_FILE, 'utf8')) as SyncState;
  } catch {
    return null;
  }
}

export function writeSyncState(state: SyncState): void {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}
