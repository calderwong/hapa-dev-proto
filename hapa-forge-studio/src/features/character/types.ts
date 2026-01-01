export type RpgStats = {
  STR: number;
  DEX: number;
  CON: number;
  INT: number;
  WIS: number;
  CHA: number;
};

export type CharacterAnalysis = {
  name: string;
  title: string;
  className: string;
  archetype: string;
  level: number;
  stats: RpgStats;
  tags: string[];
  keySkills: Array<{ name: string; rank: number; explanation: string }>;
  quote?: string;
};
