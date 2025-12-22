export interface CardIndexEntry {
  cardId: string;
  createdAt: string;

  cardType?: 'standard' | 'set' | 'merged-set' | 'pet' | 'system';
  name?: string;

  threadId?: string;
  messageId?: string;
  provider?: string;
  model?: string;

  coreName?: string;
  coreKey?: string;
  coreDiscoveryKey?: string;

  thumbnail?: string;
  mediaKind?: 'image' | 'video' | 'audio' | 'message' | 'pet';
  mediaLocalPath?: string;
  mediaRemoteUrl?: string;
  mediaMimeType?: string;
  subType?: string;

  tier?: number;

  messageContent?: string;
  messageRole?: 'user' | 'model';
  attachmentCount?: number;

  hasVideo?: boolean;
  derivedGif?: { localPath: string; cardId: string };

  cardRecord?: any;
  raw?: any;

  parentCardId?: string;

  memberOfSets?: Array<{ setCardId: string; setName?: string; joinedAt: string; addedBy: string }>;
  containedCards?: Array<{ cardId: string; cardName?: string; addedAt: string; order?: number }>;
  containedCardCount?: number;
  skills?: Array<{ id: string; name: string; type: string; description: string; icon?: string }>;

  description?: string;

  [key: string]: any;
}
