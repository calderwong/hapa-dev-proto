
export type PartType = 
  | 'COCKPIT' 
  | 'ENGINE' 
  | 'REACTOR' 
  | 'QUARTERS' 
  | 'CARGO' 
  | 'WEAPON' 
  | 'HULL' 
  | 'COMM';

export interface Part {
  id: string;
  type: PartType;
  name: string;
  size: [number, number, number];
  cost: number;
  mass: number;
  powerDraw: number;
  powerGen: number;
  crewCapacity: number;
  integrity: number;
  armorValue: number;
  platingThickness: number;
  icon: string;
  color: string;
}

export interface PlacedPart extends Part {
  instanceId: string;
  position: [number, number, number];
  rotation: number; // 0, 90, 180, 270 degrees
}

export type ViewMode = 'HULL' | 'CUTAWAY' | 'BLUEPRINT' | 'EXPLORE' | 'SYNTHESIZED';

export interface HullVisuals {
  primaryColor: string;
  accentColor: string;
  emissiveColor: string;
  finish: 'MATTE' | 'GLOSSY' | 'BRUSHED_METAL' | 'CARBON_FIBER';
  platingPattern: 'GRID' | 'HEX' | 'DIAMOND' | 'SEAMLESS';
  weathering: number; // 0 to 1
  reflectivity: number; // 0 to 1
  hullTaper: number; // For geometric adjustments
  emissivePattern: 'STREAKS' | 'PULSE' | 'STASIS' | 'FLOW' | 'GLITCH';
  panelingType: 'PLATE' | 'WELDED' | 'OVERLAP' | 'INTEGRATED' | 'SCALED';
  accentPattern: 'NONE' | 'STRIPES' | 'HAZARD' | 'CHECKER' | 'CIRCUIT';
  structuralFin: 'NONE' | 'STABILIZER' | 'SPIKE' | 'WINGLET';
  glowIntensity: number;
  detailDensity: number;
}

export interface EnvironmentConfig {
  showNebula: boolean;
  showAsteroids: boolean;
  showSolarFlare: boolean;
}

export interface ShipStats {
  totalMass: number;
  totalPowerGen: number;
  totalPowerDraw: number;
  totalCrewCapacity: number;
  totalIntegrity: number;
  totalArmor: number;
  avgPlating: number;
  defenseRating: number;
  totalCost: number;
  partCount: number;
}

export interface AIAnalysis {
  efficiencyScore: number;
  role: string;
  lore: string;
  strengths: string[];
  weaknesses: string[];
}

export interface LogEntry {
  id: string;
  text: string;
  type: 'INFO' | 'WARNING' | 'CRITICAL' | 'NEURAL';
  timestamp: number;
}

export type ForgeRole = 'SCOUT' | 'INTERCEPTOR' | 'FREIGHTER' | 'DESTROYER' | 'EXPLORER';
export type ForgeMagnitude = 'COMPACT' | 'STANDARD' | 'COLOSSAL';
export type ForgeFocus = 'MOBILITY' | 'DEFENSE' | 'ORDNANCE' | 'UTILITY';

export interface ForgeConfig {
  directive: string;
  role: ForgeRole;
  magnitude: ForgeMagnitude;
  focus: ForgeFocus;
}

export interface ShipData {
  id: string;
  name: string;
  parts: PlacedPart[];
  hullVisuals: HullVisuals | null;
  conceptImageUrl: string | null;
  videoUrl: string | null;
  analysis: AIAnalysis | null;
  createdAt: number;
  shipRotation?: number;
  bridgeSnapshots?: string[];
}

export interface Fleet {
  id: string;
  name: string;
  ships: ShipData[];
  isLocked?: boolean;
}

export interface FleetManifest {
  fleetName: string;
  ships: ShipData[];
  exportedAt: number;
}
