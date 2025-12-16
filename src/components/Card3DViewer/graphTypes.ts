/**
 * Graph Node Types for 3D Card Nexus Visualization
 * 
 * Treats cards and their internal components as nodes in a graph.
 * Components include: images, videos, transcripts, summaries, key terms, avatars.
 */

export type NodeType = 
    | 'card'           // Main card node
    | 'image'          // Image from imageSet
    | 'video'          // Video attachment
    | 'audio'          // Audio file
    | 'transcript'     // Transcription
    | 'summary'        // AI-generated summary
    | 'keyterm'        // Extracted key term
    | 'avatar'         // Profile/pet avatar
    | 'text'           // Text content origin
    | 'wiki'           // Wiki entry reference
    ;

export type EdgeType =
    | 'parent-child'       // Card parent → child relationship
    | 'card-component'     // Card → its internal component
    | 'derived-from'       // Component derived from another (e.g., video from images)
    | 'extraction'
    | 'generated'
    | 'sibling'            // Cards share same parent
    | 'reference'          // Reference/link between items
    ;

export interface GraphNode {
    id: string;                     // Unique ID for this node
    type: NodeType;                 // Type of node
    label: string;                  // Display label
    cardId?: string;                // Parent card ID (for components)
    
    // Visual properties
    thumbnailUrl?: string;          // Preview image
    tier?: string;                  // Quality tier (for cards)
    color?: string;                 // Node color
    size?: number;                  // Relative size (0.5-1.5)
    
    // Component-specific data
    localPath?: string;             // File path for media
    text?: string;                  // Text content (for summaries, transcripts)
    index?: number;                 // Position in array (for images)
    isHero?: boolean;               // Is this the hero image?
    
    // Metadata
    createdAt?: string;
    provider?: string;              // AI provider for generated content
    mimeType?: string;
}

export interface GraphEdge {
    id: string;
    fromId: string;
    toId: string;
    type: EdgeType;
    label?: string;
}

export interface CardGraphData {
    nodes: GraphNode[];
    edges: GraphEdge[];
    focusedNodeId: string;
}

// Extract graph nodes and edges from a CardData object
export function extractGraphFromCard(card: any): { nodes: GraphNode[]; edges: GraphEdge[] } {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    
    const cardId = card.cardId;
    const rec = card.cardRecord || {};
    
    // 1. Create main card node
    const cardNode: GraphNode = {
        id: cardId,
        type: 'card',
        label: card.name || 'Untitled',
        cardId: cardId,
        tier: calculateSimpleTier(card),
        size: 1.0,
        thumbnailUrl: getCardThumbnail(card),
    };
    nodes.push(cardNode);
    
    // 2. Extract images from imageSet
    const imageSet = rec.imageSet || {};
    const images = imageSet.images || [];
    const heroIndex = imageSet.heroIndex || 0;
    
    images.forEach((img: any, i: number) => {
        const imgId = `${cardId}:image:${i}`;
        nodes.push({
            id: imgId,
            type: 'image',
            label: `Image ${i + 1}`,
            cardId: cardId,
            localPath: img.localPath,
            thumbnailUrl: img.localPath ? `file://${img.localPath}` : undefined,
            index: i,
            isHero: i === heroIndex,
            size: i === heroIndex ? 0.8 : 0.6,
            color: i === heroIndex ? '#22d3ee' : '#6b7280',
            createdAt: img.generatedAt,
            mimeType: img.mimeType,
        });
        
        edges.push({
            id: `${cardId}→image:${i}`,
            fromId: cardId,
            toId: imgId,
            type: 'card-component',
            label: i === heroIndex ? 'hero' : undefined,
        });
    });
    
    // 3. Extract video
    if (rec.video?.localPath) {
        const videoId = `${cardId}:video`;
        nodes.push({
            id: videoId,
            type: 'video',
            label: 'Video',
            cardId: cardId,
            localPath: rec.video.localPath,
            thumbnailUrl: rec.video.thumbnail,
            size: 0.7,
            color: '#a855f7',
            mimeType: rec.video.mimeType,
        });
        
        edges.push({
            id: `${cardId}→video`,
            fromId: cardId,
            toId: videoId,
            type: 'card-component',
        });
        
        // If video was derived from images, add those edges
        if (images.length > 0) {
            images.forEach((_: any, i: number) => {
                edges.push({
                    id: `image:${i}→video`,
                    fromId: `${cardId}:image:${i}`,
                    toId: videoId,
                    type: 'derived-from',
                });
            });
        }
    }
    
    // 4. Extract audio
    if (rec.audio?.localPath) {
        const audioId = `${cardId}:audio`;
        nodes.push({
            id: audioId,
            type: 'audio',
            label: 'Audio',
            cardId: cardId,
            localPath: rec.audio.localPath,
            size: 0.6,
            color: '#f59e0b',
            mimeType: rec.audio.mimeType,
        });
        
        edges.push({
            id: `${cardId}→audio`,
            fromId: cardId,
            toId: audioId,
            type: 'card-component',
        });
    }
    
    // 5. Extract transcripts
    const transcripts = rec.transcripts || rec.wormhole?.transcripts || [];
    transcripts.forEach((t: any, i: number) => {
        const tId = `${cardId}:transcript:${i}`;
        nodes.push({
            id: tId,
            type: 'transcript',
            label: `Transcript`,
            cardId: cardId,
            text: t.text?.substring(0, 100),
            size: 0.5,
            color: '#10b981',
            createdAt: t.createdAt,
            provider: t.provider,
        });
        
        edges.push({
            id: `${cardId}→transcript:${i}`,
            fromId: cardId,
            toId: tId,
            type: 'card-component',
        });
    });
    
    // 6. Extract summaries
    const summaries = rec.summaries || rec.wormhole?.summaries || [];
    summaries.forEach((s: any, i: number) => {
        const sId = `${cardId}:summary:${i}`;
        nodes.push({
            id: sId,
            type: 'summary',
            label: `${s.kind || 'Summary'}`,
            cardId: cardId,
            text: s.text?.substring(0, 100),
            size: 0.5,
            color: '#3b82f6',
            createdAt: s.createdAt,
            provider: s.provider,
        });
        
        edges.push({
            id: `${cardId}→summary:${i}`,
            fromId: cardId,
            toId: sId,
            type: 'card-component',
        });
    });
    
    // 7. Extract key terms
    const keyTerms = rec.keyTerms || rec.wormhole?.keyTerms || [];
    keyTerms.slice(0, 8).forEach((kt: any, i: number) => {
        const ktId = `${cardId}:keyterm:${i}`;
        const term = typeof kt === 'string' ? kt : kt.term;
        nodes.push({
            id: ktId,
            type: 'keyterm',
            label: term || `Term ${i + 1}`,
            cardId: cardId,
            size: 0.4,
            color: '#ec4899',
        });
        
        edges.push({
            id: `${cardId}→keyterm:${i}`,
            fromId: cardId,
            toId: ktId,
            type: 'card-component',
        });
    });
    
    // 8. Text content origin (if this card has a text source)
    if (rec.text || rec.content || card.mediaKind === 'text' || card.mediaKind === 'document') {
        const textId = `${cardId}:text`;
        nodes.push({
            id: textId,
            type: 'text',
            label: 'Source Text',
            cardId: cardId,
            text: (rec.text || rec.content || '').substring(0, 100),
            size: 0.5,
            color: '#64748b',
            localPath: rec.textFile?.localPath,
        });
        
        edges.push({
            id: `${cardId}→text`,
            fromId: cardId,
            toId: textId,
            type: 'card-component',
        });
    }
    
    return { nodes, edges };
}

// Add parent-child relationships between cards
export function addCardRelationships(
    allCards: any[],
    cardId: string,
    existingNodes: GraphNode[],
    existingEdges: GraphEdge[]
): { nodes: GraphNode[]; edges: GraphEdge[] } {
    const nodes = [...existingNodes];
    const edges = [...existingEdges];
    const nodeIds = new Set(nodes.map(n => n.id));
    
    const card = allCards.find(c => c.cardId === cardId);
    if (!card) return { nodes, edges };
    
    const rec = card.cardRecord || {};
    
    // Parent relationship
    const parentId = rec.parentCardId || card.parentCardId;
    if (parentId) {
        const parentCard = allCards.find(c => c.cardId === parentId);
        if (parentCard && !nodeIds.has(parentId)) {
            const { nodes: parentNodes } = extractGraphFromCard(parentCard);
            // Only add the card node, not all components
            const parentNode = parentNodes.find(n => n.type === 'card');
            if (parentNode) {
                nodes.push(parentNode);
                nodeIds.add(parentId);
            }
        }
        
        if (nodeIds.has(parentId)) {
            edges.push({
                id: `${parentId}→${cardId}:parent`,
                fromId: parentId,
                toId: cardId,
                type: 'parent-child',
            });
        }
    }
    
    // Child relationships
    const children = allCards.filter(c => 
        c.cardRecord?.parentCardId === cardId || 
        c.parentCardId === cardId
    );
    
    children.forEach(child => {
        if (!nodeIds.has(child.cardId)) {
            const { nodes: childNodes } = extractGraphFromCard(child);
            const childNode = childNodes.find(n => n.type === 'card');
            if (childNode) {
                nodes.push(childNode);
                nodeIds.add(child.cardId);
            }
        }
        
        edges.push({
            id: `${cardId}→${child.cardId}:child`,
            fromId: cardId,
            toId: child.cardId,
            type: 'parent-child',
        });
    });
    
    return { nodes, edges };
}

// Helper functions
function calculateSimpleTier(card: any): string {
    const rec = card.cardRecord || {};
    let score = 0;
    
    if (rec.summaries?.length) score++;
    if (rec.keyTerms?.length) score++;
    if (rec.imageSet?.images?.length > 3) score++;
    if (rec.video) score++;
    if (rec.transcripts?.length) score++;
    if (card.mediaKind === 'video') score++;
    
    if (score >= 5) return 'mythic';
    if (score >= 4) return 'legendary';
    if (score >= 3) return 'epic';
    if (score >= 2) return 'rare';
    if (score >= 1) return 'uncommon';
    return 'common';
}

function toFileUrl(p?: string): string | undefined {
    if (!p) return undefined;
    const raw = String(p);
    if (raw.startsWith('file://')) {
        if (!raw.startsWith('file:///')) {
            const after = raw.slice('file://'.length).replace(/\\/g, '/');
            if (/^[A-Za-z]:\//.test(after)) return `file:///${encodeURI(after)}`;
        }
        return raw;
    }
    if (raw.startsWith('data:') || raw.startsWith('blob:') || raw.startsWith('http://') || raw.startsWith('https://')) {
        return raw;
    }
    const normalized = raw.replace(/\\/g, '/');
    return `file:///${encodeURI(normalized)}`;
}

function getCardThumbnail(card: any): string | undefined {
    if (card.thumbnail) return toFileUrl(card.thumbnail);
    const rec = card.cardRecord || {};

    if (rec.video?.thumbnailDataUrl) {
        return String(rec.video.thumbnailDataUrl);
    }
    if (rec.video?.thumbnail) {
        return toFileUrl(rec.video.thumbnail);
    }
    
    if (rec.imageSet?.images?.[rec.imageSet.heroIndex || 0]?.localPath) {
        return toFileUrl(rec.imageSet.images[rec.imageSet.heroIndex || 0].localPath);
    }
    if (rec.image?.localPath) {
        return toFileUrl(rec.image.localPath);
    }
    if (card.mediaLocalPath && card.mediaKind === 'image') {
        return toFileUrl(card.mediaLocalPath);
    }
    return undefined;
}
