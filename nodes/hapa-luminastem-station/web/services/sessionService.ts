
import JSZip from 'jszip';
import { v4 as uuidv4 } from 'uuid';
import { SessionEvent, PromptPack, LoopClip, BundleManifest, AudioStem, AudioFxSettings, VisualSettings, TempoConfig, RenderAsset, AutomationLane, VibeMarker, HapaCard, HapaArtifactRef, IntegrityReport, LibraryBundle, LibraryLoopRef, LibraryAssetRef, KeyframeMeta, KeyframeSnapshot, SessionStateSnapshot, VibeFingerprintV1, AI_VibeLabel, ShowScriptV1, MediaClip, MediaPlacement } from '../types';
import { audioService } from './audioService';
import { vibeAnalysisService } from './vibeAnalysisService';
import { Vector3 } from 'three';

class SessionService {
  private events: SessionEvent[] = [];
  private promptPacks: PromptPack[] = [];
  private loops: LoopClip[] = [];
  private renders: RenderAsset[] = [];
  private vibeMarkers: VibeMarker[] = [];
  private libraryBundles: LibraryBundle[] = [];
  
  // Vibe & Scripts
  private vibeFingerprints: VibeFingerprintV1[] = [];
  private vibeLabels: Map<string, AI_VibeLabel> = new Map(); // assetHash -> Label
  private showScripts: ShowScriptV1[] = [];

  // Media Capture
  private mediaClips: MediaClip[] = [];
  private mediaPlacements: MediaPlacement[] = [];

  // Keyframes State
  private keyframes: KeyframeMeta[] = [];
  private keyframeSnapshots: Map<string, KeyframeSnapshot> = new Map();

  // --- Stable JSON Stringify (Determinism) ---
  private stableStringify(obj: any): string {
    if (obj === null || typeof obj !== 'object') {
      return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
      return '[' + obj.map(item => this.stableStringify(item)).join(',') + ']';
    }
    const keys = Object.keys(obj).sort();
    const parts = keys.map(key => {
      // Normalize numbers if needed (e.g. limit precision) but for now rely on raw state
      return `"${key}":${this.stableStringify(obj[key])}`;
    });
    return '{' + parts.join(',') + '}';
  }

  // --- Hashing Helpers ---
  
  async computeHash(blob: Blob | ArrayBuffer): Promise<string> {
    const buffer = blob instanceof Blob ? await blob.arrayBuffer() : blob;
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async computeStringHash(str: string): Promise<string> {
      const encoder = new TextEncoder();
      const data = encoder.encode(str);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  // Sync fallback for internal IDs (not robust crypto, but determinstic enough for UI keys)
  computeStringHashSync(str: string): string {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
          const char = str.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash; 
      }
      return Math.abs(hash).toString(16);
  }

  // --- Logging ---
  logEvent(type: SessionEvent['type'], payload: any, actor: SessionEvent['actor'] = 'USER') {
    const evt: SessionEvent = {
      id: uuidv4(),
      timestamp: Date.now(),
      transportTime: audioService.getCurrentTime(),
      type,
      payload,
      actor
    };
    this.events.push(evt);
  }

  getEvents() { return this.events; }

  addPromptPack(pack: PromptPack) {
    this.promptPacks.push(pack);
  }

  addLoop(loop: LoopClip) {
    this.loops.push(loop);
    this.logEvent('LOOP_SET', loop);
  }

  getLoops() { return this.loops; }

  // --- Vibe Markers ---
  addVibeMarker(marker: VibeMarker) {
      this.vibeMarkers.push(marker);
      this.logEvent('VIBE_MARKER_ADD', { id: marker.id, sigil: marker.vector.sigil });
  }

  getVibeMarkers() { return this.vibeMarkers; }

  // --- Vibe & Scripts Storage ---
  addVibeFingerprint(fp: VibeFingerprintV1) {
      // Check for duplicates based on content hash AND scope
      const exists = this.vibeFingerprints.find(f => 
          f.vector_int8_b64 === fp.vector_int8_b64 && 
          f.source.scope === fp.source.scope &&
          JSON.stringify(f.source.asset_hashes) === JSON.stringify(fp.source.asset_hashes)
      );
      if (!exists) {
          this.vibeFingerprints.push(fp);
          this.logEvent('VIBE_FINGERPRINT_MINT', { scope: fp.source.scope });
      }
  }
  
  getVibeFingerprints() { return this.vibeFingerprints; }
  
  addVibeLabel(label: AI_VibeLabel, assetHash: string) {
      this.vibeLabels.set(assetHash, label);
  }
  
  getVibeLabel(assetHash: string) { return this.vibeLabels.get(assetHash); }

  // --- Vibe Search ---
  
  searchByVibe(targetFp: VibeFingerprintV1, topK: number = 5): { fingerprint: VibeFingerprintV1, score: number }[] {
      const targetVec = vibeAnalysisService.dequantizeVector(targetFp.vector_int8_b64);
      
      const results = this.vibeFingerprints.map(fp => {
          // Exclude self (identical ref)
          if (fp === targetFp) return { fingerprint: fp, score: -1 };
          
          const vec = vibeAnalysisService.dequantizeVector(fp.vector_int8_b64);
          const sim = this.cosineSimilarity(targetVec, vec);
          return { fingerprint: fp, score: sim };
      });

      // Filter out self or invalid
      const valid = results.filter(r => r.score > -1);

      // Sort Descending Score, then Hash Ascending (Deterministic tie-break)
      valid.sort((a, b) => {
          const diff = b.score - a.score;
          if (Math.abs(diff) < 0.0001) {
              const hA = a.fingerprint.source.asset_hashes.join('');
              const hB = b.fingerprint.source.asset_hashes.join('');
              return hA.localeCompare(hB);
          }
          return diff;
      });

      return valid.slice(0, topK);
  }

  // Similarity Helpers
  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
      if (a.length !== b.length) return 0;
      let dot = 0;
      let magA = 0;
      let magB = 0;
      for (let i = 0; i < a.length; i++) {
          dot += a[i] * b[i];
          magA += a[i] * a[i];
          magB += b[i] * b[i];
      }
      if (magA === 0 || magB === 0) return 0;
      return dot / (Math.sqrt(magA) * Math.sqrt(magB));
  }

  addShowScript(script: ShowScriptV1) {
      this.showScripts.push(script);
  }
  
  getShowScripts() { return this.showScripts; }

  // --- Media Capture ---
  addMediaClip(clip: MediaClip) {
      // Check duplicate
      if (!this.mediaClips.find(c => c.hash === clip.hash)) {
          this.mediaClips.push(clip);
          this.logEvent('MEDIA_CLIP_ADDED', { 
              id: clip.id, 
              hash: clip.hash, 
              kind: clip.kind, 
              label: clip.label 
          });
      }
  }

  getMediaClips() { return this.mediaClips; }

  addMediaPlacement(placement: MediaPlacement) {
      this.mediaPlacements.push(placement);
      this.logEvent('MEDIA_PLACEMENT_ADDED', placement);
  }

  updateMediaPlacement(id: string, updates: Partial<MediaPlacement>) {
      const idx = this.mediaPlacements.findIndex(p => p.id === id);
      if (idx !== -1) {
          this.mediaPlacements[idx] = { ...this.mediaPlacements[idx], ...updates };
          this.logEvent('MEDIA_PLACEMENT_UPDATE', { id, updates });
      }
  }
  
  removeMediaPlacement(id: string) {
      this.mediaPlacements = this.mediaPlacements.filter(p => p.id !== id);
      this.logEvent('MEDIA_PLACEMENT_REMOVED', { id });
  }

  getMediaPlacements() { return this.mediaPlacements; }

  // --- Keyframes ---

  async createKeyframe(state: SessionStateSnapshot, label: string, kind: KeyframeMeta['kind']): Promise<KeyframeMeta> {
      const now = Date.now();
      const t_ms = Math.floor(state.timestamp * 1000);
      
      // Determine base_event_index
      const base_event_index = this.events.length - 1;

      // Construct Snapshot
      const snapshot: KeyframeSnapshot = {
          schema_version: "keyframe.v1",
          id: "", // Calculated below
          t_ms,
          captured_at: new Date(now).toISOString(),
          state
      };

      // Content Address
      const canonical = this.stableStringify(snapshot);
      const hash = await this.computeStringHash(canonical);
      snapshot.id = hash;

      // Store Snapshot
      this.keyframeSnapshots.set(hash, snapshot);

      // Create Meta
      const meta: KeyframeMeta = {
          id: hash,
          t_ms,
          label: label || `Keyframe ${this.keyframes.length + 1}`,
          kind,
          created_at: new Date(now).toISOString(),
          created_by: "human",
          base_event_index,
          snapshot_path: `keyframes/${hash}.json`
      };

      this.keyframes.push(meta);
      this.keyframes.sort((a, b) => a.t_ms - b.t_ms); // Keep ordered by timeline

      this.logEvent('KEYFRAME_CREATED', meta);
      return meta;
  }

  getKeyframes() { return this.keyframes; }

  getKeyframeSnapshot(id: string) { return this.keyframeSnapshots.get(id); }

  deleteKeyframe(id: string) {
      this.keyframes = this.keyframes.filter(k => k.id !== id);
      // We keep the snapshot in map in case of undo/history, but remove from meta list
      this.logEvent('KEYFRAME_DELETED', { id });
  }

  getNearestKeyframe(timeSeconds: number): { meta: KeyframeMeta, snapshot: KeyframeSnapshot } | null {
      const timeMs = Math.floor(timeSeconds * 1000);
      // Find latest keyframe <= timeMs
      let best: KeyframeMeta | null = null;
      for (const k of this.keyframes) {
          if (k.t_ms <= timeMs) {
              if (!best || k.t_ms > best.t_ms) best = k;
          }
      }
      if (!best) return null;
      const snap = this.keyframeSnapshots.get(best.id);
      return snap ? { meta: best, snapshot: snap } : null;
  }

  // --- Rendering ---
  async addRender(blob: Blob, meta: { name: string, scope: 'LOOP' | 'SESSION', duration: number, sampleRate: number }) {
      const hash = await this.computeHash(blob);
      const asset: RenderAsset = {
          id: uuidv4(),
          hash,
          created_at: Date.now(),
          ...meta,
          blob
      };
      this.renders.push(asset);
      this.logEvent('RENDER_COMPLETE', { renderId: asset.id, hash, scope: meta.scope });
      return asset;
  }

  getRenders() { return this.renders; }

  updateTempo(config: Partial<TempoConfig>) {
      audioService.updateTempoConfig(config);
      if (config.bpm !== undefined) this.logEvent('TEMPO_UPDATE', { bpm: config.bpm });
      if (config.snapEnabled !== undefined) this.logEvent('SNAP_TOGGLE', { enabled: config.snapEnabled });
      if (config.metronomeEnabled !== undefined) this.logEvent('METRONOME_TOGGLE', { enabled: config.metronomeEnabled });
  }

  // --- LIBRARY & IMPORT ---
  
  getLibraryBundles() { return this.libraryBundles; }

  async importZip(file: File): Promise<{ 
      type: 'hapa_bundle' | 'loop_pack' | 'unknown_zip'; 
      zip: JSZip; 
      hash: string; 
      audioFiles: string[];
  }> {
      const arrayBuffer = await file.arrayBuffer();
      const hash = await this.computeHash(arrayBuffer);
      const zip = await JSZip.loadAsync(arrayBuffer);
      
      const hasManifest = zip.file("bundle_manifest.json") !== null;
      const audioFiles = Object.keys(zip.files).filter(f => 
          !f.startsWith('__MACOSX') && 
          (f.endsWith('.wav') || f.endsWith('.mp3') || f.endsWith('.ogg') || f.endsWith('.m4a'))
      );

      let type: 'hapa_bundle' | 'loop_pack' | 'unknown_zip' = 'unknown_zip';
      if (hasManifest) type = 'hapa_bundle';
      else if (audioFiles.length > 0) type = 'loop_pack';

      this.logEvent('LIB_ZIP_IMPORTED', { hash, type, filename: file.name, audioCount: audioFiles.length });

      return { type, zip, hash, audioFiles };
  }

  async processHapaToLibrary(zip: JSZip, hash: string, filename: string) {
      if (this.libraryBundles.find(b => b.bundleId === hash)) return; // Dedupe

      // Parse Hapa Bundle to extract loops
      const manifestStr = await zip.file("bundle_manifest.json")!.async("string");
      const manifest: BundleManifest = JSON.parse(manifestStr);
      
      // Get Session Card to find Loops and Stems
      const sessionCardStr = await zip.file(manifest.card_index[manifest.session_card_id])!.async("string");
      const sessionCard: HapaCard = JSON.parse(sessionCardStr);

      // Extract LoopCards
      const loopIds = sessionCard.payload.refs.loops || [];
      const stemIds = sessionCard.payload.refs.stems || [];

      // 1. Map all Stems to Assets (to know paths)
      const assetMap: { [stemRuntimeId: string]: LibraryAssetRef } = {};
      const libraryAssets: LibraryAssetRef[] = [];

      for (const sId of stemIds) {
          const path = manifest.card_index[sId];
          if (zip.file(path)) {
              const c: HapaCard = JSON.parse(await zip.file(path)!.async("string"));
              if (c.artifacts.length > 0) {
                  const art = c.artifacts[0];
                  // Create Library Asset Ref
                  const libAsset: LibraryAssetRef = {
                      id: art.hash,
                      path: art.path,
                      name: c.payload.name,
                      type: art.mimeType,
                      size: 0 // zip doesn't give size easily without stat, ignore for now
                  };
                  libraryAssets.push(libAsset);
                  assetMap[c.payload.runtime_id] = libAsset; // stem runtime ID to asset
              }
          }
      }

      // 2. Create Library Loops
      const libraryLoops: LibraryLoopRef[] = [];
      
      const fullSessionAssetMap: { [d: number]: string } = {};
      
      for (const sId of stemIds) {
          const path = manifest.card_index[sId];
          const c: HapaCard = JSON.parse(await zip.file(path)!.async("string"));
          // find asset hash
          if (c.artifacts.length > 0) {
             const assetHash = c.artifacts[0].hash;
             const fleet = c.payload.fleetId !== undefined ? c.payload.fleetId : 0;
             if (!fullSessionAssetMap[fleet]) fullSessionAssetMap[fleet] = assetHash;
          }
      }
      
      libraryLoops.push({
          id: uuidv4(),
          title: "Full Session Mix",
          duration: 30, // Default or calculate max
          assetMap: fullSessionAssetMap,
          origin: { bundleId: hash, type: 'from_hapa_session' }
      });

      // Loop Clips defined in session
      for (const lId of loopIds) {
           const path = manifest.card_index[lId];
           if (zip.file(path)) {
               const c: HapaCard = JSON.parse(await zip.file(path)!.async("string"));
               const loopClip: LoopClip = c.payload;
               libraryLoops.push({
                   id: uuidv4(),
                   title: loopClip.name,
                   duration: loopClip.end - loopClip.start,
                   assetMap: fullSessionAssetMap, // Reuses same stems, just different time/context in theory
                   origin: { bundleId: hash, type: 'from_hapa_session', originLoopId: lId }
               });
           }
      }

      const bundle: LibraryBundle = {
          bundleId: hash,
          source: 'hapa_bundle',
          label: filename,
          importedAt: Date.now(),
          assets: libraryAssets,
          loops: libraryLoops,
          rawZip: zip
      };

      this.libraryBundles.push(bundle);
  }

  async processPackToLibrary(zip: JSZip, hash: string, filename: string, config: { mode: 'separate' | 'combined', assignments: { [file: string]: number } }) {
      if (this.libraryBundles.find(b => b.bundleId === hash)) return;

      const audioFiles = Object.keys(zip.files).filter(f => 
          !f.startsWith('__MACOSX') && 
          (f.endsWith('.wav') || f.endsWith('.mp3') || f.endsWith('.ogg') || f.endsWith('.m4a'))
      );
      
      const assets: LibraryAssetRef[] = [];
      const fileToHash: {[f:string]: string} = {};

      for (const f of audioFiles) {
          const blob = await zip.file(f)!.async("blob");
          const fHash = await this.computeHash(blob);
          fileToHash[f] = fHash;
          assets.push({
              id: fHash,
              path: f,
              name: f.split('/').pop() || f,
              type: blob.type,
              size: blob.size
          });
      }

      const loops: LibraryLoopRef[] = [];

      if (config.mode === 'separate') {
          // One loop per file
          for (const f of audioFiles) {
              const asset = assets.find(a => a.path === f)!;
              loops.push({
                  id: uuidv4(),
                  title: asset.name,
                  duration: 10, // Unknown until decode. UI will show "?".
                  assetMap: { 0: asset.id }, // Default to Deck A
                  origin: { bundleId: hash, type: 'from_loop_pack_audio' }
              });
          }
      } else {
          // Combined
          const map: { [d: number]: string } = {};
          for (const [file, deck] of Object.entries(config.assignments)) {
              const h = fileToHash[file];
              if (h) map[deck] = h;
          }
          loops.push({
              id: uuidv4(),
              title: filename.replace('.zip', ''),
              duration: 10,
              assetMap: map,
              origin: { bundleId: hash, type: 'from_loop_pack_audio' }
          });
      }

      this.logEvent('LIB_LOOP_PACK_CONFIG', { hash, config });

      const bundle: LibraryBundle = {
          bundleId: hash,
          source: 'loop_pack',
          label: filename,
          importedAt: Date.now(),
          assets: assets,
          loops: loops,
          rawZip: zip
      };
      
      this.libraryBundles.push(bundle);
  }

  async getAssetFromBundle(bundleId: string, assetId: string): Promise<{ blob: Blob, buffer: AudioBuffer } | null> {
      const bundle = this.libraryBundles.find(b => b.bundleId === bundleId);
      if (!bundle) return null;
      
      const assetRef = bundle.assets.find(a => a.id === assetId);
      if (!assetRef) return null;

      const file = bundle.rawZip.file(assetRef.path);
      if (!file) return null;

      const blob = await file.async("blob");
      const arrayBuffer = await blob.arrayBuffer();
      const buffer = await audioService.decodeAudioData(arrayBuffer);
      
      return { blob, buffer };
  }

  // --- HAPA CARD GENERATORS ---

  private async createCard(
      type: HapaCard['card_type'], 
      payload: any, 
      artifacts: HapaArtifactRef[] = [], 
      supersedes: string[] = []
  ): Promise<HapaCard> {
      // For Media Clips, payload might contain blob which isn't serializable.
      // We must sanitize payload before stringify.
      const sanitizedPayload = { ...payload };
      if (sanitizedPayload.blob) delete sanitizedPayload.blob;

      const payloadStr = JSON.stringify(sanitizedPayload);
      const specHash = await this.computeStringHash(payloadStr);
      
      return {
          id: uuidv4(),
          card_type: type,
          spec_hash: specHash,
          artifacts,
          meta: {
              created_at: Date.now(),
              created_by: "LuminaStem 3D",
              supersedes,
              schema_version: "1.0.0"
          },
          payload: sanitizedPayload
      };
  }

  // --- Export ---
  async exportSession(
    stems: AudioStem[], 
    visualSettings: VisualSettings, 
    audioSettings: AudioFxSettings,
    mixerValues: any
  ): Promise<Blob> {
    const zip = new JSZip();
    const cardsFolder = zip.folder("cards");
    const stemCardsFolder = cardsFolder?.folder("stem_asset_cards");
    const loopCardsFolder = cardsFolder?.folder("loop_cards");
    const renderCardsFolder = cardsFolder?.folder("render_cards");
    const promptCardsFolder = cardsFolder?.folder("promptpack_cards");
    const vibeCardsFolder = cardsFolder?.folder("vibe_cards"); 
    const scriptCardsFolder = cardsFolder?.folder("showscript_cards");
    const mediaCardsFolder = cardsFolder?.folder("media_clip_cards");
    const analysisCardsFolder = cardsFolder?.folder("analysis"); // NEW
    const keyframesFolder = zip.folder("keyframes");

    const manifestCards: { [key: string]: string } = {};
    const assetsFolder = zip.folder("assets");

    // 1. Stems -> Stem Cards & Artifacts
    const stemIds = [];
    
    for (const stem of stems) {
        if (!stem.rawBlob) continue;
        
        const fileHash = await this.computeHash(stem.rawBlob);
        const ext = stem.name.split('.').pop() || 'dat';
        const fileName = `${fileHash}.${ext}`;
        const filePath = `assets/${fileName}`;
        
        // Add Blob to Zip (Content Addressed)
        assetsFolder?.file(fileName, stem.rawBlob);

        const artifact: HapaArtifactRef = {
            name: stem.name,
            hash: fileHash,
            path: filePath,
            mimeType: stem.rawBlob.type
        };

        const payload = {
            runtime_id: stem.id,
            name: stem.name,
            fleetId: stem.fleetId,
            color: stem.color,
            position: { x: stem.position.x, y: stem.position.y, z: stem.position.z },
            vol: stem.volume,
            muted: stem.isMuted,
            duration: stem.duration
        };

        const card = await this.createCard('STEM', payload, [artifact]);
        stemCardsFolder?.file(`${card.id}.json`, JSON.stringify(card, null, 2));
        manifestCards[card.id] = `cards/stem_asset_cards/${card.id}.json`;
        stemIds.push(card.id);
    }

    // 2. Loops -> Loop Cards
    const loopIds = [];
    for (const loop of this.loops) {
        const card = await this.createCard('LOOP', loop);
        loopCardsFolder?.file(`${card.id}.json`, JSON.stringify(card, null, 2));
        manifestCards[card.id] = `cards/loop_cards/${card.id}.json`;
        loopIds.push(card.id);
    }

    // 3. Renders -> Render Cards
    const renderIds = [];
    for (const render of this.renders) {
        if (!render.blob) continue;
        const fileHash = await this.computeHash(render.blob);
        const fileName = `${fileHash}.wav`;
        const filePath = `assets/${fileName}`;
        assetsFolder?.file(fileName, render.blob);
        
        const artifact: HapaArtifactRef = {
            name: render.name,
            hash: fileHash,
            path: filePath,
            mimeType: 'audio/wav'
        };
        
        const payload = {
            name: render.name,
            duration: render.duration,
            sampleRate: render.sampleRate,
            scope: render.scope
        };

        const card = await this.createCard('RENDER', payload, [artifact]);
        renderCardsFolder?.file(`${card.id}.json`, JSON.stringify(card, null, 2));
        manifestCards[card.id] = `cards/render_cards/${card.id}.json`;
        renderIds.push(card.id);
    }

    // 4. Prompts -> Prompt Cards
    const promptIds = [];
    for (const pack of this.promptPacks) {
        const card = await this.createCard('PROMPT', pack);
        promptCardsFolder?.file(`${card.id}.json`, JSON.stringify(card, null, 2));
        manifestCards[card.id] = `cards/promptpack_cards/${card.id}.json`;
        promptIds.push(card.id);
    }
    
    // 5. Vibe Fingerprints & Labels (ANALYSIS CARDS)
    const vibeIds = [];
    
    // Index Buffer for JSONL
    const indexLines: string[] = [];

    // VIBE FINGERPRINTS
    for (const fp of this.vibeFingerprints) {
        const card = await this.createCard('VIBE_FINGERPRINT', fp);
        vibeCardsFolder?.file(`${card.id}.json`, JSON.stringify(card, null, 2));
        manifestCards[card.id] = `cards/vibe_cards/${card.id}.json`;
        vibeIds.push(card.id);
        
        // Add to Index
        indexLines.push(JSON.stringify({
            vibe_id: card.id,
            scope: fp.source.scope,
            asset_hashes: fp.source.asset_hashes,
            vector: fp.vector_int8_b64,
            tags: [], // Placeholder
            created_at: Date.now()
        }));
    }
    
    // VIBE LABELS
    for (const [hash, label] of this.vibeLabels) {
        const card = await this.createCard('VIBE_LABEL', { assetHash: hash, label });
        analysisCardsFolder?.file(`label_${hash}.json`, JSON.stringify(card, null, 2));
        manifestCards[card.id] = `cards/analysis/label_${hash}.json`;
        // We track label cards in session indirectly via hydration, 
        // but for export completeness we should reference them if possible.
        // For now they are just in the bundle.
    }

    // 6. Show Scripts
    const scriptIds = [];
    for (const script of this.showScripts) {
        const card = await this.createCard('SHOW_SCRIPT', script);
        scriptCardsFolder?.file(`${card.id}.json`, JSON.stringify(card, null, 2));
        manifestCards[card.id] = `cards/showscript_cards/${card.id}.json`;
        scriptIds.push(card.id);
    }

    // 7. Media Clips
    const mediaIds = [];
    for (const clip of this.mediaClips) {
        if (!clip.blob) continue;
        // The blob is authoritative content
        const fileHash = clip.hash; // Already computed
        const ext = clip.mimeType.includes('video') ? 'webm' : 'webm'; // naive
        const fileName = `${fileHash}.${ext}`;
        const filePath = `assets/${fileName}`;
        
        assetsFolder?.file(fileName, clip.blob);

        const artifact: HapaArtifactRef = {
            name: clip.label,
            hash: fileHash,
            path: filePath,
            mimeType: clip.mimeType
        };

        const card = await this.createCard('MEDIA_CLIP', clip, [artifact]);
        mediaCardsFolder?.file(`${card.id}.json`, JSON.stringify(card, null, 2));
        manifestCards[card.id] = `cards/media_clip_cards/${card.id}.json`;
        mediaIds.push(card.id);
    }

    // 8. Keyframes
    keyframesFolder?.file("index.json", JSON.stringify(this.keyframes, null, 2));
    for (const snap of this.keyframeSnapshots.values()) {
        const canonical = this.stableStringify(snap);
        keyframesFolder?.file(`${snap.id}.json`, canonical);
    }

    // 9. Session Card (Master)
    const sessionPayload = {
        settings: {
            visual: visualSettings,
            audio: audioSettings,
            mixer: mixerValues,
            tempo: audioService.getTempoConfig()
        },
        automation: audioService.getLanes(),
        vibe_markers: this.vibeMarkers,
        refs: {
            stems: stemIds,
            loops: loopIds,
            prompts: promptIds,
            renders: renderIds,
            vibes: vibeIds,
            scripts: scriptIds,
            media_clips: mediaIds
        },
        media_placements: this.mediaPlacements,
        event_log: this.events
    };

    const sessionCard = await this.createCard('SESSION', sessionPayload);
    cardsFolder?.file(`session_card.json`, JSON.stringify(sessionCard, null, 2));
    manifestCards[sessionCard.id] = `cards/session_card.json`;

    // 10. Bundle Manifest
    const manifest: BundleManifest = {
        bundle_id: uuidv4(), 
        schema_version: "1.0.0",
        created_at: Date.now(),
        created_by_app: "LuminaStem 3D",
        session_card_id: sessionCard.id,
        card_index: manifestCards,
        environment: {
            sample_rate: 44100,
            platform: "web"
        }
    };

    zip.file("bundle_manifest.json", JSON.stringify(manifest, null, 2));
    
    // 11. Import Provenance Index & Vibe Index
    const importsIndex = {
        library_bundles: this.libraryBundles.map(b => ({
            id: b.bundleId,
            label: b.label,
            source: b.source
        }))
    };
    const importsFolder = zip.folder("imports");
    importsFolder?.file("import_index.json", JSON.stringify(importsIndex, null, 2));
    
    // Vibe Index
    if (indexLines.length > 0) {
        zip.folder("index")?.file("vibe_index.jsonl", indexLines.join('\n'));
    }

    return await zip.generateAsync({ type: "blob" });
  }

  // --- Import ---
  async importSession(file: File): Promise<{
    stems: AudioStem[],
    loops: LoopClip[],
    settings: any,
    promptPacks: PromptPack[],
    integrity: IntegrityReport
  }> {
    const zip = await JSZip.loadAsync(file);
    const report: IntegrityReport = { status: 'SECURE', errors: [], verifiedCount: 0 };
    
    // Reset volatile collections
    this.showScripts = [];
    this.vibeFingerprints = [];
    this.vibeLabels.clear();
    this.mediaClips = [];
    this.mediaPlacements = [];

    // 1. Read Manifest
    const manifestFile = zip.file("bundle_manifest.json");
    if (!manifestFile) throw new Error("Missing bundle_manifest.json");
    
    const manifestStr = await manifestFile.async("string");
    const manifest: BundleManifest = JSON.parse(manifestStr);
    
    // 2. Read Session Card
    const sessionCardPath = manifest.card_index[manifest.session_card_id];
    const sessionCardFile = zip.file(sessionCardPath);
    if (!sessionCardFile) throw new Error("Session Card missing");
    
    const sessionCardStr = await sessionCardFile.async("string");
    const sessionCard: HapaCard = JSON.parse(sessionCardStr);
    
    // VERIFY SESSION HASH
    const computedSessionHash = await this.computeStringHash(JSON.stringify(sessionCard.payload));
    if (computedSessionHash !== sessionCard.spec_hash) {
        report.status = 'UNTRUSTED';
        report.errors.push("Session Card payload modified (Hash Mismatch)");
    } else {
        report.verifiedCount++;
    }

    const payload = sessionCard.payload;
    
    // Hydrate State
    this.events = payload.event_log || [];
    this.vibeMarkers = payload.vibe_markers || [];
    this.mediaPlacements = payload.media_placements || [];
    
    // Hydrate Settings
    if (payload.settings.tempo) audioService.updateTempoConfig(payload.settings.tempo);
    if (payload.automation) audioService.loadAutomation(payload.automation);

    const settings = payload.settings;

    // 3. Hydrate Keyframes (New Feature)
    this.keyframes = [];
    this.keyframeSnapshots.clear();
    const kfIndexFile = zip.file("keyframes/index.json");
    if (kfIndexFile) {
        const kfIndexStr = await kfIndexFile.async("string");
        const loadedKeyframes: KeyframeMeta[] = JSON.parse(kfIndexStr);
        this.keyframes = loadedKeyframes;
        
        // Load snapshots
        for (const kf of loadedKeyframes) {
             const snapFile = zip.file(`keyframes/${kf.id}.json`);
             if (snapFile) {
                 const snapStr = await snapFile.async("string");
                 const hash = await this.computeStringHash(snapStr);
                 if (hash !== kf.id) {
                     report.status = 'UNTRUSTED';
                     report.errors.push(`Keyframe hash mismatch: ${kf.label}`);
                 } else {
                     report.verifiedCount++;
                 }
                 const snap: KeyframeSnapshot = JSON.parse(snapStr);
                 this.keyframeSnapshots.set(kf.id, snap);
             }
        }
    }

    // 4. Hydrate Stems (Verify Artifacts)
    const stems: AudioStem[] = [];
    const stemIds = payload.refs.stems || [];

    for (const stemCardId of stemIds) {
        const path = manifest.card_index[stemCardId];
        if (!path) { report.errors.push(`Missing card path for ${stemCardId}`); continue; }
        
        const f = zip.file(path);
        if (!f) continue;
        
        const c: HapaCard = JSON.parse(await f.async("string"));
        
        // Verify Card Hash
        if ((await this.computeStringHash(JSON.stringify(c.payload))) !== c.spec_hash) {
             report.status = 'UNTRUSTED';
             report.errors.push(`Stem Card ${c.id} corrupted.`);
        }

        // Verify Artifact
        if (c.artifacts.length > 0) {
            const artifact = c.artifacts[0];
            const assetFile = zip.file(artifact.path);
            
            if (assetFile) {
                const blob = await assetFile.async("blob");
                const blobHash = await this.computeHash(blob);
                
                if (blobHash !== artifact.hash) {
                    report.status = 'UNTRUSTED';
                    report.errors.push(`Artifact Hash Mismatch: ${artifact.name}`);
                } else {
                    report.verifiedCount++;
                }

                // Hydrate Audio
                const arrayBuffer = await blob.arrayBuffer();
                const buffer = await audioService.decodeAudioData(arrayBuffer);
                const coarseWaveform = audioService.getCoarseWaveform(buffer);
                const { analyser, gain, lowPassNode, highPassNode } = audioService.createStemNodes(buffer);
                
                stems.push({
                    id: c.payload.runtime_id || uuidv4(),
                    hash: artifact.hash,
                    name: c.payload.name,
                    rawBlob: blob,
                    buffer: buffer,
                    sourceNode: null,
                    analyserNode: analyser,
                    gainNode: gain,
                    lowPassNode, highPassNode,
                    position: new Vector3(c.payload.position.x, c.payload.position.y, c.payload.position.z),
                    color: c.payload.color,
                    isPlaying: false,
                    isMuted: c.payload.muted || false,
                    volume: c.payload.vol || 1,
                    smartVolume: 1,
                    focusMultiplier: 1,
                    fleetId: c.payload.fleetId,
                    duration: buffer.duration,
                    coarseWaveform
                });
            } else {
                report.errors.push(`Missing asset file: ${artifact.path}`);
            }
        }
    }

    // 5. Hydrate Loops
    const loops: LoopClip[] = [];
    const loopIds = payload.refs.loops || [];
    for (const id of loopIds) {
        const path = manifest.card_index[id];
        if (path && zip.file(path)) {
            const c: HapaCard = JSON.parse(await zip.file(path)!.async("string"));
            loops.push(c.payload);
        }
    }
    this.loops = loops;

    // 6. Hydrate Prompts
    const promptPacks: PromptPack[] = [];
    const promptIds = payload.refs.prompts || [];
    for (const id of promptIds) {
        const path = manifest.card_index[id];
        if (path && zip.file(path)) {
            const c: HapaCard = JSON.parse(await zip.file(path)!.async("string"));
            promptPacks.push(c.payload);
        }
    }
    this.promptPacks = promptPacks;
    
    // 7. Hydrate ShowScripts (if any)
    const scriptIds = payload.refs.scripts || [];
    for (const id of scriptIds) {
        const path = manifest.card_index[id];
        if (path && zip.file(path)) {
             const c: HapaCard = JSON.parse(await zip.file(path)!.async("string"));
             this.showScripts.push(c.payload);
        }
    }

    // 8. Hydrate Media Clips
    const mediaIds = payload.refs.media_clips || [];
    for (const id of mediaIds) {
        const path = manifest.card_index[id];
        if (path && zip.file(path)) {
            const c: HapaCard = JSON.parse(await zip.file(path)!.async("string"));
            const clip: MediaClip = c.payload;
            
            // Reattach blob from artifact
            if (c.artifacts.length > 0) {
                const art = c.artifacts[0];
                const f = zip.file(art.path);
                if (f) {
                    const blob = await f.async("blob");
                    const blobHash = await this.computeHash(blob);

                    if (blobHash !== art.hash) {
                         report.status = 'UNTRUSTED';
                         report.errors.push(`Media Clip Hash Mismatch: ${art.name}`);
                    } else {
                         report.verifiedCount++;
                    }

                    clip.blob = blob;
                }
            }
            this.mediaClips.push(clip);
        }
    }
    
    // 9. Hydrate Vibe Fingerprints
    const vibeIds = payload.refs.vibes || [];
    for (const id of vibeIds) {
        const path = manifest.card_index[id];
        if (path && zip.file(path)) {
            const c: HapaCard = JSON.parse(await zip.file(path)!.async("string"));
            this.addVibeFingerprint(c.payload);
        }
    }
    
    // 10. Hydrate Labels (Scan cards folder for type VIBE_LABEL)
    for (const key in manifest.card_index) {
        const path = manifest.card_index[key];
        if (path.includes("analysis/label_")) {
            const f = zip.file(path);
            if (f) {
                try {
                    const c: HapaCard = JSON.parse(await f.async("string"));
                    if (c.card_type === 'VIBE_LABEL') {
                        this.addVibeLabel(c.payload.label, c.payload.assetHash);
                    }
                } catch(e) {}
            }
        }
    }

    return { stems, loops, settings, promptPacks, integrity: report };
  }
}

export const sessionService = new SessionService();
