/**
 * Card Types and Interfaces
 * 
 * Core principle: Every AI-generated derivative gets its own Card and Hypercore.
 * All derivatives maintain parent-child relationships.
 */

// ============================================================================
// Base Types
// ============================================================================

export type MediaType = 'image' | 'video' | 'audio' | 'document' | 'message' | 'pet';

export type ImageSubType = 
    | 'generated'       // AI-generated from context
    | 'uploaded'        // User uploaded
    | 'sprite-sheet'    // Grid of animation frames
    | 'seed'            // Marked as seed for derivatives
    | 'upscaled'        // AI-upscaled version
    | 'variation';      // AI variation of another image

export type VideoSubType = 
    | 'loop-video'      // AI-generated looping video from image
    | 'uploaded'        // User uploaded
    | 'recording';      // Screen/audio recording

export type AudioSubType = 
    | 'sprite-sfx'      // Sound effect for sprite animation
    | 'uploaded'        // User uploaded
    | 'recording'       // Voice/audio recording
    | 'generated';      // AI-generated audio

// ============================================================================
// Child Reference (stored in parent's children array)
// ============================================================================

export interface ChildReference {
    cardId: string;
    type: string;           // e.g., 'image', 'loop-video', 'sprite-animation'
    label?: string;         // Display name
    imageUrl?: string;      // Thumbnail for quick display
    createdAt?: string;
}

// ============================================================================
// Image Card
// ============================================================================

export interface ImageCard {
    id: string;
    type: 'card';
    mediaType: 'image';
    subType: ImageSubType;
    
    // Relationships
    parentId: string;           // Links to source card
    children?: ChildReference[]; // Child loop videos, upscaled versions, etc.
    
    // Content
    title: string;
    thumbnail?: string;         // Base64 or URL
    
    // File storage
    wormhole?: {
        ingest: {
            originalPath: string;
            mimeType?: string;
        };
    };
    
    // Generation metadata
    generationPrompt?: string;      // The crafted prompt used
    generationModel?: string;       // e.g., 'gemini-2.0-flash-exp'
    generationIndex?: number;       // Which # in series (1, 2, 3...)
    seriesContext?: {               // If part of a series
        previousPrompt?: string;
        continuationOf?: string;    // cardId of previous image
    };
    
    // Standard fields
    tags: string[];
    createdAt: string;
    updatedAt?: string;
}

// ============================================================================
// Video Card (Loop Videos, etc.)
// ============================================================================

export interface VideoCard {
    id: string;
    type: 'card';
    mediaType: 'video';
    subType: VideoSubType;
    
    // Relationships
    parentId: string;           // For loop-video: points to IMAGE card, not source
    children?: ChildReference[];
    
    // Content
    title: string;
    thumbnail?: string;
    
    // File storage
    wormhole?: {
        ingest: {
            originalPath: string;
            mimeType?: string;
        };
    };
    
    // Generation metadata (for loop-videos)
    generationPrompt?: string;      // Motion prompt
    generationModel?: string;
    sourceImage?: {
        cardId: string;
        path: string;
    };
    
    // Standard fields
    tags: string[];
    createdAt: string;
    updatedAt?: string;
}

// ============================================================================
// Legacy Support - ImageSet (DEPRECATED, for backwards compat)
// ============================================================================

export interface LegacyImageEntry {
    id: string;
    localPath: string;
    mimeType?: string;
    craftedPrompt?: string;
    generatedAt?: string;
    creationOrder?: number;
}

export interface LegacyImageSet {
    images: LegacyImageEntry[];
    heroIndex: number;
    displayOrder: number[];
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Determines if a card has image children (new system)
 */
export function hasImageChildren(card: any): boolean {
    return card.children?.some((c: ChildReference) => c.type === 'image') ?? false;
}

/**
 * Determines if a card uses legacy imageSet (old system)
 */
export function hasLegacyImageSet(card: any): boolean {
    return card.imageSet?.images?.length > 0;
}

/**
 * Get all images from a card (supports both new children and legacy imageSet)
 */
export interface ImageReference {
    cardId?: string;        // If it's a card
    url?: string;           // Direct URL (legacy)
    localPath?: string;     // Local path (legacy)
    isCard: boolean;        // True if this is a proper Image Card
    craftedPrompt?: string;
    createdAt?: string;
    index: number;
}

export function getCardImages(card: any): ImageReference[] {
    const images: ImageReference[] = [];
    
    // NEW: From children array (Image Cards)
    const imageChildren = card.children?.filter((c: ChildReference) => c.type === 'image') || [];
    imageChildren.forEach((child: ChildReference, i: number) => {
        images.push({
            cardId: child.cardId,
            url: child.imageUrl,
            isCard: true,
            createdAt: child.createdAt,
            index: i,
        });
    });
    
    // LEGACY: From imageSet (embedded images, not cards)
    if (card.imageSet?.images?.length > 0) {
        card.imageSet.images.forEach((img: LegacyImageEntry, i: number) => {
            images.push({
                localPath: img.localPath,
                craftedPrompt: img.craftedPrompt,
                createdAt: img.generatedAt,
                isCard: false,
                index: images.length + i,
            });
        });
    }
    
    return images;
}

/**
 * Get loop video for an image (if it has one as a child)
 */
export function getLoopVideoChild(imageCard: any): ChildReference | null {
    return imageCard.children?.find((c: ChildReference) => c.type === 'loop-video') || null;
}
