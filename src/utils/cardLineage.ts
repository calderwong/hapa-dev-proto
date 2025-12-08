/**
 * Card Lineage Utilities
 * 
 * Calculates ancestry (parents up to root) and descendant (children recursively) counts
 * for cards to display as "power level" badges.
 */

export interface LineageInfo {
  ancestorCount: number;    // How many cards above (0 = root)
  descendantCount: number;  // How many cards below (recursive)
  isRoot: boolean;          // True if no parent
  isLeaf: boolean;          // True if no children
  depth: number;            // Same as ancestorCount (alias)
  spawn: number;            // Same as descendantCount (alias)
}

export interface CardLineageEntry {
  cardId: string;
  parentCardId?: string | null;
  children?: Array<{ cardId: string }>;
}

/**
 * Build maps for efficient lineage traversal
 */
export function buildLineageMaps(cards: CardLineageEntry[]): {
  parentMap: Map<string, string | null>;
  childrenMap: Map<string, string[]>;
} {
  const parentMap = new Map<string, string | null>();
  const childrenMap = new Map<string, string[]>();

  // First pass: build parent map and initialize children map
  for (const card of cards) {
    parentMap.set(card.cardId, card.parentCardId || null);
    if (!childrenMap.has(card.cardId)) {
      childrenMap.set(card.cardId, []);
    }
  }

  // Second pass: build children map from parent relationships
  for (const card of cards) {
    if (card.parentCardId && parentMap.has(card.parentCardId)) {
      const siblings = childrenMap.get(card.parentCardId) || [];
      if (!siblings.includes(card.cardId)) {
        siblings.push(card.cardId);
        childrenMap.set(card.parentCardId, siblings);
      }
    }
    
    // Also check cardRecord.children for direct children references
    if (card.children && Array.isArray(card.children)) {
      const existingChildren = childrenMap.get(card.cardId) || [];
      for (const child of card.children) {
        if (child.cardId && !existingChildren.includes(child.cardId)) {
          existingChildren.push(child.cardId);
        }
      }
      childrenMap.set(card.cardId, existingChildren);
    }
  }

  return { parentMap, childrenMap };
}

/**
 * Count ancestors (walk up parent chain to root)
 */
export function countAncestors(
  cardId: string,
  parentMap: Map<string, string | null>,
  visited: Set<string> = new Set()
): number {
  // Prevent infinite loops
  if (visited.has(cardId)) return 0;
  visited.add(cardId);

  const parentId = parentMap.get(cardId);
  if (!parentId) return 0;
  
  return 1 + countAncestors(parentId, parentMap, visited);
}

/**
 * Count descendants (recursive sum of all children)
 */
export function countDescendants(
  cardId: string,
  childrenMap: Map<string, string[]>,
  visited: Set<string> = new Set()
): number {
  // Prevent infinite loops
  if (visited.has(cardId)) return 0;
  visited.add(cardId);

  const children = childrenMap.get(cardId) || [];
  return children.reduce((sum, childId) => {
    return sum + 1 + countDescendants(childId, childrenMap, visited);
  }, 0);
}

/**
 * Get complete lineage info for a single card
 */
export function getLineageInfo(
  cardId: string,
  parentMap: Map<string, string | null>,
  childrenMap: Map<string, string[]>
): LineageInfo {
  const ancestorCount = countAncestors(cardId, parentMap);
  const descendantCount = countDescendants(cardId, childrenMap);
  const children = childrenMap.get(cardId) || [];

  return {
    ancestorCount,
    descendantCount,
    isRoot: ancestorCount === 0,
    isLeaf: children.length === 0,
    depth: ancestorCount,
    spawn: descendantCount,
  };
}

/**
 * Calculate lineage for all cards at once (efficient batch operation)
 */
export function calculateAllLineage(
  cards: CardLineageEntry[]
): Map<string, LineageInfo> {
  const { parentMap, childrenMap } = buildLineageMaps(cards);
  const lineageMap = new Map<string, LineageInfo>();

  for (const card of cards) {
    lineageMap.set(card.cardId, getLineageInfo(card.cardId, parentMap, childrenMap));
  }

  return lineageMap;
}

/**
 * Get ancestor path (list of card IDs from this card to root)
 */
export function getAncestorPath(
  cardId: string,
  parentMap: Map<string, string | null>,
  visited: Set<string> = new Set()
): string[] {
  if (visited.has(cardId)) return [];
  visited.add(cardId);

  const parentId = parentMap.get(cardId);
  if (!parentId) return [];
  
  return [parentId, ...getAncestorPath(parentId, parentMap, visited)];
}

/**
 * Get tier/power level based on lineage (for visual styling)
 * Higher spawn count = more "powerful/productive" card
 */
export function getLineagePowerTier(lineage: LineageInfo): 'legendary' | 'epic' | 'rare' | 'common' {
  const { spawn, depth } = lineage;
  
  // Combine spawn and depth for "power" calculation
  const power = spawn * 2 + depth;
  
  if (power >= 20) return 'legendary';
  if (power >= 10) return 'epic';
  if (power >= 5) return 'rare';
  return 'common';
}

/**
 * Format lineage count for display (with abbreviation for large numbers)
 */
export function formatLineageCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  if (count >= 100) return count.toString();
  return count.toString();
}
