import React from 'react';
import { Vector3, Quaternion, Euler } from 'three';

// --- STEMS & AUDIO ---
export interface AudioStem {
  id: string; // Runtime ID
  hash: string; // SHA-256 of raw bytes (Asset ID)
  name: string;
  rawBlob?: Blob; // Stored for export
  buffer: AudioBuffer;
  sourceNode: AudioBufferSourceNode | null;
  analyserNode: AnalyserNode;
  gainNode: GainNode;
  // Filter Nodes
  lowPassNode: BiquadFilterNode;
  highPassNode: BiquadFilterNode;
  position: Vector3;
  color: string;
  isPlaying: boolean;
  isMuted: boolean;
  volume: number; 
  
  // Real-time
  smartVolume: number;
  focusMultiplier: number;
  
  // Grouping
  groupId?: string; 
  fleetId: number; 

  // Nav
  duration: number;
  coarseWaveform: number[]; 
}

// --- EFFECTS DECK ---
export type EffectParamType = 'number' | 'boolean' | 'color' | 'vec3' | 'enum';

export interface EffectParamSchema {
    name: string;
    type: EffectParamType;
    default: any;
    min?: number;
    max?: number;
    step?: number;
    options?: string[]; // for enum
}

export interface EffectDefinition {
    id: string;
    name: string;
    description: string;
    params: Record<string, EffectParamSchema>;
    component: React.FC<any>; // The R3F component
}

export interface EffectInstance {
    instanceId: string;
    effectId: string;
    enabled: boolean;
    params: Record<string, any>;
    seed: string; // Deterministic seed for this instance
}

export interface EffectsDeckState {
    sessionSeed: string;
    instances: EffectInstance[];
    activePresetId?: string;
}

export interface EffectPreset {
    id: string;
    name: string;
    instances: Omit<EffectInstance, 'seed'>[]; // Seeds are regenerated on apply usually, or persisted? Let's say regenerated or fixed.
    // Actually, preserving seeds ensures identical visual noise patterns.
    // But applying a preset to a new session might want new noise. 
    // Let's store full instances.
}

// --- MEDIA CAPTURE & PLACEMENT ---
export type MediaClipType = 'webcam' | 'screen' | 'mic' | 'imported';

export interface MediaClip {
  id: string;
  hash: string; // sha256 of blob
  mimeType: string;
  kind: MediaClipType;
  createdAt: number;
  durationSec: number;
  label: string;
  thumbnailDataUrl?: string; // Base64 image
  audioFingerprintRef?: string; // VIBE_FINGERPRINT id
  blob?: Blob; // Runtime usage only (not serialized directly in JSON, but via Asset)
}

export interface MediaPlacement {
  id: string; // Unique placement ID
  clipHash: string; // Content addressed
  position: { x: number, y: number, z: number };
  rotation: { x: number, y: number, z: number };
  scale: { x: number, y: number, z: number };
  attachMode: 'world' | 'camera' | 'fleetA' | 'fleetB' | 'fleetC';
  loop: boolean;
  opacity: number;
  emissiveGain: number;
}

// --- KEYFRAMES & SNAPSHOTS ---
export interface KeyframeMeta {
  id: string;              // sha256(snapshotCanonicalJson)
  t_ms: number;            // transport time at capture (int ms)
  label: string;           // user-visible name
  kind: "manual" | "auto" | "loop_take";
  created_at: string;      // ISO
  created_by: "human" | "ai";
  base_event_index: number; // index into events array at time of capture
  snapshot_path: string;     // e.g., "keyframes/<id>.json"
}

export interface SessionStateSnapshot {
  timestamp: number;
  stems: {
    id: string;
    vol: number;
    muted: boolean;
    pos: { x: number, y: number, z: number };
    fleetId: number;
  }[];
  mixer: { a: number, b: number, c: number };
  audioSettings: AudioFxSettings;
  visualSettings: VisualSettings;
  effectsState: EffectsDeckState; // NEW
  activeLoopId: string | null;
  tempo: TempoConfig;
}

export interface KeyframeSnapshot {
  schema_version: "keyframe.v1";
  id: string;
  t_ms: number;
  captured_at: string;
  state: SessionStateSnapshot;
}

// --- VIBE & AI ---
export interface VibeVector {
  // Quantized 0-255
  bass: number;
  mid: number;
  high: number;
  dynamics: number;
  brightness: number;
  flux: number;
  
  // Representations
  bytes: Uint8Array;     // Compact
  base64: string;        // Storage
  sigil: string;         // Visual (Emoji string)
  hexHash: string;       // Short ID
}

export interface VibeFingerprintV1 {
  schema_version: "vibe_fingerprint.v1";
  source: {
      scope: "stem" | "deck" | "loop" | "render";
      asset_hashes: string[];
      slice: { start: number; end: number } | null;
  };
  vector_int8_b64: string; // Quantized feature vector (Base64 of Int8Array)
  features: {
      bpm_estimate: number;
      bpm_confidence: number;
      rms_mean: number;
      crest_factor: number;
      spectral_centroid_mean: number;
      rolloff_mean: number;
      flatness_mean: number;
      band_energy: number[]; // 8 bands
      onset_rate: number;
  };
  time_structures?: {
      beat_grid: number[];
      energy_envelope: number[];
  };
  analysis_version: string;
  // Metadata for index
  id?: string;
  created_at?: number;
}

export interface AI_VibeLabel {
    moods: string[];
    genres: string[];
    instruments: string[];
    energy_curve: 'rising' | 'falling' | 'constant' | 'volatile';
    recommended_visual_presets: string[];
    recommended_show_script_beats: number[]; // Timestamps for visual hits
    text_summary: string;
    tags: string[];
}

export interface VibeMarker {
  id: string;
  timestamp: number; // Realtime creation
  transportTime: number; // Where in the track
  note: string;
  vector: VibeVector;
  fingerprint?: VibeFingerprintV1;
  aiLabel?: AI_VibeLabel;
  scope: 'LOOP' | 'SESSION' | 'MOMENT';
}

export interface AIAction {
  type: 'SET_REVERB' | 'SET_DELAY' | 'SET_MIXER' | 'SET_SPEED' | 'SET_DISTORTION';
  target?: string; // 'A', 'B', 'C' for mixer
  value: number;
}

export interface AIProposal {
  id: string;
  vibeName: string;
  reasoning: string;
  actions: AIAction[];
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
}

// --- ANALYSIS JOB ---
export type AnalysisJobKind = "DSP_FINGERPRINT" | "GEMINI_AUDIO_LABEL";

export interface AnalysisJob {
  jobId: string; // sha256(stableStringify(jobSpec))
  kind: AnalysisJobKind;
  target: {
    scope: "stem"|"deck"|"loop"|"render"|"media_clip";
    assetHashes: string[];
    slice?: { start_ms: number, end_ms: number } | null;
    stemId?: string; // Runtime ID ref
  };
  versions: {
    dspVersion: string;
    promptTemplateVersion?: string;
    modelId?: string;
  };
  priority: number;
  createdAt: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  error?: string;
  resultId?: string; // ID of the resulting card
}

// --- SHOW SCRIPT ---
export interface ShowEvent {
    t: number; // Transport time (seconds)
    type: 'SET_VISUAL' | 'SET_CAMERA' | 'SET_FORMATION' | 'TRIGGER_FX' | 'SET_EFFECT_PARAM' | 'SET_EFFECT_ENABLED' | 'APPLY_PRESET';
    key?: string; // e.g. 'meshDistortion' or effect param name
    value?: any;
    instanceId?: string; // For effect targeting
    duration?: number; // Transition duration
}

export interface ShowScriptV1 {
    schema_version: "showscript.v1";
    id: string;
    seed: string; // RNG seed
    name: string;
    tempo_ref: number;
    events: ShowEvent[];
}

// --- AUTOMATION ---
export interface AutomationPoint {
    time: number; // Seconds relative to transport start
    value: number;
}

export interface AutomationLane {
    id: string; // unique lane ID
    targetId: string; // Stem ID or 'global' or 'effect:<instanceId>'
    param: string; // 'filterCutoff' | 'volume' | 'reverb' | 'delay' | 'mixerA' ...
    points: AutomationPoint[];
    mode: 'READ' | 'WRITE' | 'OFF';
    color?: string;
    label?: string;
}

// --- CONFIG & FORMATIONS ---
export interface FormationConfig {
  name: string;
  description: string;
  code: {
    x: string;
    y: string;
    z: string;
  }
}

export interface VisualSettings {
  meshDistortion: number;
  wireframeMode: boolean;
  connectionLines: boolean;
  connectionElasticity: number;
  particleDensity: number;
  chromaticAberration: number;
  gridWarp: number;
}

export interface AudioFxSettings {
  playbackSpeed: number;
  reverbAmount: number;
  delayAmount: number;
  stutterEnabled: boolean;
  stutterInterval: number;
  mixAllStems: boolean;
}

export interface TempoConfig {
  bpm: number;
  gridOffset: number; // Seconds to shift the grid start
  subdivision: number; // 4 = 1/4, 8 = 1/8, 16 = 1/16
  snapEnabled: boolean;
  metronomeEnabled: boolean;
}

// --- EVENT SOURCING & BUNDLES ---

export interface SessionEvent {
  id: string;
  timestamp: number; // Unix Epoch ms
  transportTime: number; // Playhead position in seconds
  type: 'PLAY' | 'STOP' | 'SEEK' | 'LOOP_SET' | 'MUTE_TOGGLE' | 'MIXER_UPDATE' | 'IMPORT_STEM' | 'FX_UPDATE' | 'FORMATION_CHANGE' | 'AI_INSIGHT' | 'TEMPO_UPDATE' | 'METRONOME_TOGGLE' | 'SNAP_TOGGLE' | 'RENDER_REQUESTED' | 'RENDER_COMPLETE' | 'AUTOMATION_RECORD' | 'AUTOMATION_MODE' | 'VIBE_MARKER_ADD' | 'AI_PROPOSAL_GEN' | 'AI_PROPOSAL_DECISION' | 
        'LIB_ZIP_IMPORTED' | 'LIB_LOOP_PACK_CONFIG' | 'LIB_LOOP_AUDITION_START' | 'LIB_LOOP_AUDITION_STOP' | 'LIB_LOOP_CLONED' |
        'KEYFRAME_CREATED' | 'KEYFRAME_DELETED' | 'KEYFRAME_RESTORED' | 'STEM_POS_UPDATE' |
        'VIBE_FINGERPRINT_MINT' | 'SHOW_SCRIPT_GENERATED' | 'SHOW_SCRIPT_APPLY' |
        'MEDIA_CLIP_ADDED' | 'MEDIA_PLACEMENT_ADDED' | 'MEDIA_PLACEMENT_UPDATE' | 'MEDIA_PLACEMENT_REMOVED' |
        'MEDIA_RECORD_START' | 'MEDIA_RECORD_STOP' | 'EVENT_EXECUTED' |
        'ANALYSIS_JOB_ENQUEUED' | 'ANALYSIS_JOB_STARTED' | 'ANALYSIS_JOB_COMPLETE' | 'ANALYSIS_JOB_FAILED' |
        'EFFECT_INSTANCE_ADD' | 'EFFECT_INSTANCE_REMOVE' | 'EFFECT_PARAM_UPDATE' | 'EFFECT_PRESET_APPLIED' | 'EFFECT_PRESET_SAVED';
  payload: any;
  actor: 'USER' | 'SYSTEM' | 'AI';
}

export interface PromptPack {
  id: string;
  model: string;
  config: any;
  input: string;
  output: string; // Raw text response
  created_at: number;
  purpose: string; // "MATH_EXPLANATION" | "FORMATION_GEN" | "VIBE_ANALYSIS" | "SHOW_SCRIPT_GEN" | "AUDIO_LABEL"
}

export interface LoopClip {
  id: string;
  name: string;
  start: number; // Seconds
  end: number;   // Seconds
  color?: string;
}

export interface RenderAsset {
  id: string;
  hash: string;
  name: string; // e.g. "Loop 1 Bounce" or "Full Session"
  created_at: number;
  duration: number; // seconds
  sampleRate: number;
  scope: 'LOOP' | 'SESSION';
  blob?: Blob; // The WAV file
}

// --- HAPA CARD ARCHITECTURE ---

export type IntegrityStatus = 'SECURE' | 'UNTRUSTED' | 'CORRUPTED';

export interface IntegrityReport {
    status: IntegrityStatus;
    errors: string[];
    verifiedCount: number;
}

export interface HapaArtifactRef {
    name: string;
    hash: string;
    path: string;
    mimeType: string;
}

export interface HapaCard {
    id: string; // UUID or Hash
    card_type: 'SESSION' | 'STEM' | 'LOOP' | 'RENDER' | 'PROMPT' | 'VIBE' | 'VIBE_FINGERPRINT' | 'VIBE_LABEL' | 'SHOW_SCRIPT' | 'MEDIA_CLIP' | 'ANALYSIS_JOB' | 'EFFECT_PRESET';
    spec_hash: string; // Hash of the payload
    artifacts: HapaArtifactRef[];
    meta: {
        created_at: number;
        created_by: string;
        supersedes: string[];
        schema_version: string;
    };
    payload: any;
}

export interface BundleManifest {
  bundle_id: string; // Overall hash
  schema_version: string;
  created_at: number;
  created_by_app: string;
  session_card_id: string;
  card_index: { [key: string]: string }; // id -> path
  environment: {
      sample_rate: number;
      platform: string;
  };
}

export interface TelemetryData {
  fps: number;
  activeStems: number;
  totalPolyCount: number;
  fftSize: number;
  sampleRate: number;
  frequencyBinCount: number;
  averageDecibels: number;
  mathExplanation: string;
  loopCount: number;
  bpm: number;
}

// Legacy but kept for compat
export interface SessionData {
  version: string;
  timestamp: number;
  stems: {
    name: string;
    position: { x: number, y: number, z: number };
    color: string;
    isMuted: boolean;
    volume: number;
    fleetId: number;
  }[];
  customFormation?: FormationConfig;
  cameraShakeEnabled: boolean;
  shakeIntensity: number;
}

// --- LOOP LIBRARY ---

export interface LibraryAssetRef {
    id: string; // hash of file
    path: string; // zip path
    name: string;
    type: string; // inferred mime
    size: number;
}

export interface LibraryLoopRef {
    id: string;
    title: string;
    duration: number;
    // Map deck/slot index (0,1,2) to an asset ID within the bundle
    assetMap: { [deckId: number]: string }; 
    origin: {
        bundleId: string;
        type: 'from_hapa_session' | 'from_loop_pack_audio';
        originLoopId?: string; // If mapped from a Hapa LoopClip
    }
}

export interface LibraryBundle {
    bundleId: string; // SHA-256 of the ZIP file
    source: 'hapa_bundle' | 'loop_pack' | 'unknown_zip';
    label: string; // Filename
    importedAt: number;
    assets: LibraryAssetRef[];
    loops: LibraryLoopRef[];
    // We hold the Zip in memory for this session to allow audition/clone
    rawZip: any; // JSZip object
}

// --- INPUTS ---
export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

export interface HandData {
  landmarks: HandLandmark[];
  isClosed: boolean;
  isSpread: boolean;
  gestureDelta: number;
  screenPosition: { x: number, y: number };
  velocity: { x: number, y: number, z: number };
}

export enum FormationType {
  SWARM = 'SWARM',
  ORBIT = 'ORBIT',
  HELIX = 'HELIX',
  GRID = 'GRID',
  VORTEX = 'VORTEX',
  CUSTOM = 'CUSTOM (AI)'
}