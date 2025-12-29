import type { HypercoreEvent } from './persistence-types';

type WikiRelatedNode = { id: string; title: string };

type WikiNodeEventPayload = {
  id: string;
  title: string;
  summary?: string;
  sourceCardId?: string;
  createdAt?: string;
  relatedNodes?: WikiRelatedNode[];
  replaceRelatedEdges?: boolean;
};

const toNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const slugifyTerm = (term: string): string => {
  const slug = term
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'term';
};

const normalizeRelatedNodes = (value: unknown): WikiRelatedNode[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const nodes: WikiRelatedNode[] = [];

  for (const item of value) {
    const title = toNonEmptyString(item);
    if (!title) continue;
    const id = slugifyTerm(title);
    nodes.push({ id, title });
  }

  return nodes.length > 0 ? nodes : undefined;
};

export function normalizeWikiRecordToEvent(record: unknown): HypercoreEvent<WikiNodeEventPayload> | null {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null;

  const r = record as any;
  const recordType = toNonEmptyString(r.type);
  if (!recordType) return null;

  const now = new Date().toISOString();

  if (recordType === 'wiki-entry') {
    const term = toNonEmptyString(r.term);
    if (!term) return null;

    const id = slugifyTerm(term);
    const createdAt = toNonEmptyString(r.createdAt) || now;
    const sourceCardId = toNonEmptyString(r.sourceCardId) || undefined;

    return {
      type: 'WIKI_NODE_CREATED',
      payload: {
        id,
        title: term,
        sourceCardId,
        createdAt,
      },
      timestamp: now,
    };
  }

  if (recordType === 'wiki-term-meta') {
    const term = toNonEmptyString(r.term);
    if (!term) return null;

    const slug = toNonEmptyString(r.slug);
    const id = slug || slugifyTerm(term);

    const summary = toNonEmptyString(r.definition) || undefined;
    const createdAt = toNonEmptyString(r.updatedAt) || toNonEmptyString(r.createdAt) || now;
    const relatedNodes = normalizeRelatedNodes(r.relatedTerms);

    return {
      type: 'WIKI_NODE_CREATED',
      payload: {
        id,
        title: term,
        summary,
        createdAt,
        relatedNodes,
        replaceRelatedEdges: true,
      },
      timestamp: now,
    };
  }

  return null;
}
