/**
 * Unified Card Model
 * 
 * The single source of truth for what a "Card" is in the Hapa ecosystem.
 * This unifies:
 * - HandCard (Context/Drag)
 * - CardIndexEntry (Library/Persistence)
 * - ForgedCard (Thor's Hamma)
 * - PetCard (Companions)
 */

export type CardType = 'standard' | 'set' | 'merged-set' | 'pet' | 'chat' | 'weather' | 'location' | 'system';
export type MediaKind = 'image' | 'video' | 'audio' | 'text' | 'code' | 'message' | 'pet';

export interface UnifiedCard {
  // Identity
  id: string;              // Unique ID (UUID or Hypercore Key)
  coreKey?: string;        // Hypercore Key (if persisted)
  
  // Metadata
  name: string;            // Display Name
  description?: string;    // Short description
  type: CardType;          // Functional type
  kind: MediaKind;         // Media content type
  createdAt: string;       // ISO Timestamp
  
  // Content
  content?: string;        // Text content (for messages/notes)
  mediaPath?: string;      // Local path to media file
  thumbnail?: string;      // Local path or Base64 thumbnail
  url?: string;            // Source URL (for iframe/portal)
  
  // Relationships
  parentId?: string;       // Parent Card ID
  children?: UnifiedCard[]; // Child cards (if loaded)
  
  // State
  iframeMode?: boolean;    // Should open in portal/iframe?
  isLive?: boolean;        // Is this a realtime/live card?
  
  // Raw Data (Legacy/Specifics)
  raw?: any;               // Original data source (e.g. API response)
}

/**
 * Adapter: Convert Legacy CardIndexEntry to UnifiedCard
 */
export function indexToUnified(entry: any): UnifiedCard {
  return {
    id: entry.cardId,
    coreKey: entry.coreKey,
    name: entry.name || entry.title || 'Untitled Card',
    type: entry.cardType || 'standard',
    kind: entry.mediaKind || 'text',
    createdAt: entry.createdAt,
    mediaPath: entry.mediaLocalPath,
    thumbnail: entry.thumbnail,
    url: entry.sourceUrl || entry.url,
    iframeMode: entry.iframeMode,
    raw: entry
  };
}
