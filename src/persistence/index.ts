/**
 * Persistence Layer Exports
 * 
 * This module provides the abstraction for fast local queries
 * on top of Hypercore data.
 */

export * from './types';
export type { PersistenceAdapter } from './PersistenceAdapter';

// Note: SqliteAdapter is in electron/ folder and used in main process only
// Import it directly in electron/main.ts:
// import { SqliteAdapter } from './SqliteAdapter';
