
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { ShipCanvas } from './components/ShipCanvas';
import { ShipSidebar } from './components/ShipSidebar';
import { HUD } from './components/HUD';
import { AIModal } from './components/AIModal';
import { ForgeModal } from './components/ForgeModal';
import { FleetModal } from './components/FleetModal';
import { MetricsManual } from './components/MetricsManual';
import { PlacedPart, ViewMode, ShipStats, AIAnalysis, HullVisuals, Part, LogEntry, ForgeConfig, ShipData, FleetManifest, Fleet, EnvironmentConfig } from './types';
import { AVAILABLE_PARTS, DEMO_FLEET } from './constants';
import { analyzeShip, generateShip, synthesizeHullVisuals, generateConceptArt, generateShipVideo } from './services/geminiService';

const FLEETS_SAVE_KEY = 'astraforge_fleets_v3';
const ACTIVE_FLEET_ID_KEY = 'astraforge_active_fleet_id';

const getEffectiveSize = (baseSize: [number, number, number], rotation: number): [number, number, number] => {
  const [w, h, d] = baseSize;
  return (rotation === 90 || rotation === 270) ? [d, h, w] : [w, h, d];
};

const checkOverlap = (
  pos1: [number, number, number], size1: [number, number, number], rot1: number,
  pos2: [number, number, number], size2: [number, number, number], rot2: number
): boolean => {
  const [w1, h1, d1] = getEffectiveSize(size1, rot1);
  const [w2, h2, d2] = getEffectiveSize(size2, rot2);
  return (
    Math.abs(pos1[0] - pos2[0]) < (w1 + w2) / 2 - 0.01 &&
    Math.abs(pos1[1] - pos2[1]) < (h1 + h2) / 2 - 0.01 &&
    Math.abs(pos1[2] - pos2[2]) < (d1 + d2) / 2 - 0.01
  );
};

type AstraForgeAppProps = {
  /** If provided, the app will import this ShipData into a writable fleet and load it as the active ship. */
  importShipData?: ShipData;
  /** A stable key to ensure we only import once per Library item / handoff. */
  importSourceId?: string;
};

const App: React.FC<AstraForgeAppProps> = ({ importShipData, importSourceId }) => {
  const [fleets, setFleets] = useState<Fleet[]>([]);
  const [activeFleetId, setActiveFleetId] = useState<string>('');
  const [activeShipId, setActiveShipId] = useState<string>('');
  
  const [placedParts, setPlacedParts] = useState<PlacedPart[]>([]);
  const [shipName, setShipName] = useState<string>('');
  const [hullVisuals, setHullVisuals] = useState<HullVisuals | null>(null);
  const [conceptImageUrl, setConceptImageUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [shipRotation, setShipRotation] = useState<number>(0);
  const [snapshots, setSnapshots] = useState<string[]>([]);
  const [environmentConfig, setEnvironmentConfig] = useState<EnvironmentConfig>({
    showNebula: true,
    showAsteroids: false,
    showSolarFlare: false,
  });

  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const selectedPart = useMemo(() => AVAILABLE_PARTS.find(p => p.id === selectedPartId) || null, [selectedPartId]);

  const [currentFloor, setCurrentFloor] = useState<number>(0);
  const [viewMode, setViewMode] = useState<ViewMode>('HULL');
  const [isLaunchMode, setIsLaunchMode] = useState<boolean>(false);
  const [isSymmetryEnabled, setIsSymmetryEnabled] = useState<boolean>(false);
  const [currentRotation, setCurrentRotation] = useState<number>(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isForgeOpen, setIsForgeOpen] = useState<boolean>(false);
  const [isForging, setIsForging] = useState<boolean>(false);
  const [isManualOpen, setIsManualOpen] = useState<boolean>(false);
  const [isFleetOpen, setIsFleetOpen] = useState<boolean>(false);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const [isGeneratingArt, setIsGeneratingArt] = useState<boolean>(false);
  const [videoLoadingStatus, setVideoLoadingStatus] = useState<string | null>(null);

  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);

  // Guards against repeated imports when fleets state changes (which happens often due to persistence).
  const lastImportedKeyRef = useRef<string | null>(null);

  const addLog = useCallback((text: string, type: LogEntry['type'] = 'INFO') => {
    setLogs(prev => [{ id: crypto.randomUUID(), text, type, timestamp: Date.now() }, ...prev].slice(0, 8));
  }, []);

  useEffect(() => {
    const savedFleets = localStorage.getItem(FLEETS_SAVE_KEY);
    const savedActiveFleetId = localStorage.getItem(ACTIVE_FLEET_ID_KEY);
    
    let initialFleets: Fleet[] = [];
    if (savedFleets) {
      try {
        const parsed = JSON.parse(savedFleets);
        if (Array.isArray(parsed)) initialFleets = parsed;
      } catch (e) {
        console.error("Failed to load fleets", e);
      }
    }

    const demoIndex = initialFleets.findIndex(f => f.id === DEMO_FLEET.id);
    if (demoIndex > -1) initialFleets[demoIndex] = DEMO_FLEET;
    else initialFleets.unshift(DEMO_FLEET);

    if (initialFleets.length === 1 && initialFleets[0].id === DEMO_FLEET.id) {
        const userFleet: Fleet = { id: crypto.randomUUID(), name: 'Commanders Fleet', ships: [] };
        initialFleets.push(userFleet);
    }

    setFleets(initialFleets);
    const fleetId = savedActiveFleetId || (initialFleets[1] ? initialFleets[1].id : initialFleets[0].id);
    setActiveFleetId(fleetId);
    
    const activeFleet = initialFleets.find(f => f.id === fleetId) || initialFleets[0];
    const ships = activeFleet.ships || [];
    if (ships.length > 0) {
      loadShipData(ships[0]);
    } else {
      const newShip: ShipData = { id: crypto.randomUUID(), name: 'NEW VESSEL', parts: [], hullVisuals: null, conceptImageUrl: null, videoUrl: null, analysis: null, createdAt: Date.now() };
      activeFleet.ships = [newShip];
      loadShipData(newShip);
    }
    
    addLog("Neural link to Fleet Hangar established.", "NEURAL");
  }, []);

  const loadShipData = (ship: ShipData) => {
    if (!ship) return;
    setActiveShipId(ship.id);
    setPlacedParts(ship.parts || []);
    setShipName(ship.name || 'UNNAMED');
    setHullVisuals(ship.hullVisuals || null);
    setConceptImageUrl(ship.conceptImageUrl || null);
    setVideoUrl(ship.videoUrl || null);
    setAnalysis(ship.analysis || null);
    setShipRotation(ship.shipRotation || 0);
    setSnapshots(ship.bridgeSnapshots || []);
  };

  // Import ship from external handoff (e.g., Library open) into a writable fleet.
  useEffect(() => {
    if (!importShipData) return;
    if (fleets.length === 0) return; // Wait until fleets load from localStorage.

    const importKey = (importSourceId || importShipData.id || '').trim();
    if (!importKey) return;
    if (lastImportedKeyRef.current === importKey) return;

    // Mark as handled (prevents loops when fleet persistence updates).
    lastImportedKeyRef.current = importKey;

    // Clone + normalize required fields (avoid mutating props).
    // IMPORTANT: If the incoming ship doesn't have a stable id, fall back to a deterministic id derived
    // from importSourceId so repeated opens do NOT create duplicates across page reloads.
    const stableFallbackId = (importSourceId && importSourceId.trim())
      ? `imported-${importSourceId.trim()}`
      : crypto.randomUUID();

    const normalized: ShipData = {
      id: (importShipData.id && importShipData.id.trim()) ? importShipData.id : stableFallbackId,
      name: (importShipData.name && importShipData.name.trim()) ? importShipData.name : 'IMPORTED VESSEL',
      parts: Array.isArray(importShipData.parts) ? [...importShipData.parts] : [],
      hullVisuals: importShipData.hullVisuals ?? null,
      conceptImageUrl: importShipData.conceptImageUrl ?? null,
      videoUrl: importShipData.videoUrl ?? null,
      analysis: importShipData.analysis ?? null,
      createdAt: typeof importShipData.createdAt === 'number' ? importShipData.createdAt : Date.now(),
      shipRotation: typeof importShipData.shipRotation === 'number' ? importShipData.shipRotation : 0,
      bridgeSnapshots: Array.isArray(importShipData.bridgeSnapshots) ? [...importShipData.bridgeSnapshots] : [],
    };

    const shipStructureKey = (s: ShipData): string => {
      const parts = (s.parts || []).map((p: any) => {
        const pos = Array.isArray(p.position) ? p.position.join(',') : '';
        const rot = typeof p.rotation === 'number' ? p.rotation : '';
        const pid = typeof p.id === 'string' ? p.id : '';
        return `${pid}@${pos}:${rot}`;
      });
      parts.sort();
      return `${s.name || ''}|${parts.join(';')}`;
    };

    // 1) If this ship already exists in any fleet:
    //    - if it's effectively the same ship, just switch to it
    //    - if it's different, we'll clone the import to avoid overwriting
    let existingSame: { fleetId: string; ship: ShipData } | null = null;
    let existingCollision: { fleetId: string; ship: ShipData } | null = null;
    for (const fleet of fleets) {
      const existing = (fleet.ships || []).find((s) => s.id === normalized.id);
      if (!existing) continue;

      const same = shipStructureKey(existing) === shipStructureKey(normalized);
      if (same) {
        existingSame = { fleetId: fleet.id, ship: existing };
      } else {
        existingCollision = { fleetId: fleet.id, ship: existing };
      }
      break;
    }

    if (existingSame) {
      setActiveFleetId(existingSame.fleetId);
      loadShipData(existingSame.ship);
      addLog(`Imported ship already exists. Loaded ${existingSame.ship.name}.`, 'INFO');
      return;
    }

    // 2) Find a writable fleet: prefer current active fleet if unlocked, otherwise first unlocked.
    const current = fleets.find((f) => f.id === activeFleetId);
    const writable = (current && !current.isLocked)
      ? current
      : fleets.find((f) => !f.isLocked);

    // 3) If id collides with a different ship, clone id/name to avoid overwriting.
    const shipToInsert: ShipData = existingCollision
      ? {
          ...normalized,
          id: crypto.randomUUID(),
          name: `${normalized.name} (Imported)`,
          createdAt: Date.now(),
        }
      : normalized;

    if (!writable) {
      // No writable fleet exists; create one.
      const newFleet: Fleet = {
        id: crypto.randomUUID(),
        name: 'Imported Fleet',
        ships: [shipToInsert],
      };
      setFleets((prev) => [...prev, newFleet]);
      setActiveFleetId(newFleet.id);
      loadShipData(shipToInsert);
      addLog(`Imported ship loaded into new fleet: ${newFleet.name}.`, 'INFO');
      return;
    }

    // 4) Insert into writable fleet and load it.
    setFleets((prev) =>
      prev.map((f) =>
        f.id === writable.id
          ? { ...f, ships: [...(f.ships || []), shipToInsert] }
          : f
      )
    );
    setActiveFleetId(writable.id);
    loadShipData(shipToInsert);
    addLog(`Imported ship loaded into ${writable.name}.`, 'INFO');
  }, [importShipData, importSourceId, fleets, activeFleetId, addLog]);

  useEffect(() => {
    if (!activeFleetId || !activeShipId) return;
    setFleets(prev => prev.map(f => {
      if (f.id !== activeFleetId) return f;
      const ships = f.ships || [];
      return {
        ...f,
        ships: ships.map(s => s.id === activeShipId ? { 
          ...s, parts: placedParts, name: shipName, hullVisuals, conceptImageUrl, videoUrl, analysis, shipRotation, bridgeSnapshots: snapshots 
        } : s)
      };
    }));
  }, [placedParts, shipName, hullVisuals, conceptImageUrl, videoUrl, analysis, activeShipId, activeFleetId, shipRotation, snapshots]);

  useEffect(() => {
    if (fleets.length > 0) {
      localStorage.setItem(FLEETS_SAVE_KEY, JSON.stringify(fleets));
      localStorage.setItem(ACTIVE_FLEET_ID_KEY, activeFleetId);
    }
  }, [fleets, activeFleetId]);

  const toggleBridgeCam = async () => {
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      setVideoStream(null);
      addLog("Bridge Cam Deactivated.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setVideoStream(stream);
      addLog("Bridge Cam Active.", "INFO");
    } catch (err) {
      addLog("Failed to access camera hardware.", "CRITICAL");
    }
  };

  const captureSnapshot = () => {
    if (!videoStream) return;
    const video = document.createElement('video');
    video.srcObject = videoStream;
    video.onloadedmetadata = () => {
      video.play();
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/png');
      setSnapshots(prev => [dataUrl, ...prev].slice(0, 10));
      addLog("Bridge snapshot recorded.", "NEURAL");
    };
  };

  const activeFleet = useMemo(() => fleets.find(f => f.id === activeFleetId), [fleets, activeFleetId]);

  const handleSwitchFleet = (id: string) => {
    const target = fleets.find(f => f.id === id);
    if (!target) return;
    setActiveFleetId(id);
    const ships = target.ships || [];
    if (ships.length > 0) {
      loadShipData(ships[0]);
    } else {
      const newShip: ShipData = { id: crypto.randomUUID(), name: 'NEW VESSEL', parts: [], hullVisuals: null, conceptImageUrl: null, videoUrl: null, analysis: null, createdAt: Date.now() };
      setFleets(prev => prev.map(f => f.id === id ? { ...f, ships: [newShip] } : f));
      loadShipData(newShip);
    }
    addLog(`Switched to Fleet: ${target.name}`, "INFO");
  };

  const handleCreateNewFleet = () => {
    const newFleet: Fleet = { id: crypto.randomUUID(), name: 'New Expedition Fleet', ships: [] };
    setFleets(prev => [...prev, newFleet]);
    handleSwitchFleet(newFleet.id);
  };

  const handleCreateNewShip = () => {
    if (!activeFleetId) return;
    const newId = crypto.randomUUID();
    const newShip: ShipData = {
      id: newId,
      name: `VESSEL-${(activeFleet?.ships?.length || 0) + 1}`,
      parts: [],
      hullVisuals: null,
      conceptImageUrl: null,
      videoUrl: null,
      analysis: null,
      createdAt: Date.now(),
      shipRotation: 0
    };
    setFleets(prev => prev.map(f => f.id === activeFleetId ? { ...f, ships: [...(f.ships || []), newShip] } : f));
    loadShipData(newShip);
    addLog(`New hull commissioned.`, "INFO");
  };

  const handleSwitchShip = (id: string) => {
    const target = activeFleet?.ships?.find(s => s.id === id);
    if (!target) return;
    loadShipData(target);
    setViewMode('HULL');
    addLog(`Docking with ${target.name}`, "NEURAL");
  };

  const handleDeleteShip = (id: string) => {
    if (!activeFleet || !activeFleet.ships) return;
    if (activeFleet.ships.length <= 1) {
      addLog("Hangar safety protocol: Fleet must contain at least one hull.", "WARNING");
      return;
    }
    setFleets(prev => prev.map(f => f.id === activeFleetId ? { ...f, ships: (f.ships || []).filter(s => s.id !== id) } : f));
    if (activeShipId === id) {
      loadShipData(activeFleet.ships.find(s => s.id !== id)!);
    }
    addLog("Vessel decommissioned.", "WARNING");
  };

  const handleCloneShip = (id: string) => {
    const target = activeFleet?.ships?.find(s => s.id === id);
    if (!target) return;
    const clone: ShipData = { ...target, id: crypto.randomUUID(), name: `${target.name} (Copy)`, createdAt: Date.now() };
    setFleets(prev => prev.map(f => f.id === activeFleetId ? { ...f, ships: [...(f.ships || []), clone] } : f));
    addLog("Design pattern duplicated.", "INFO");
  };

  const stats = useMemo<ShipStats>(() => {
    const base = (placedParts || []).reduce((acc, p) => ({
      totalMass: acc.totalMass + p.mass,
      totalPowerGen: acc.totalPowerGen + p.powerGen,
      totalPowerDraw: acc.totalPowerDraw + p.powerDraw,
      totalCrewCapacity: acc.totalCrewCapacity + p.crewCapacity,
      totalIntegrity: acc.totalIntegrity + p.integrity,
      totalArmor: acc.totalArmor + p.armorValue,
      sumPlating: acc.sumPlating + p.platingThickness,
      totalCost: acc.totalCost + p.cost,
      partCount: acc.partCount + 1
    }), { totalMass: 0, totalPowerGen: 0, totalPowerDraw: 0, totalCrewCapacity: 0, totalIntegrity: 0, totalArmor: 0, sumPlating: 0, totalCost: 0, partCount: 0 });
    const avgPlating = base.partCount > 0 ? base.sumPlating / base.partCount : 0;
    const defenseRating = (base.totalArmor * 0.5 + base.totalIntegrity * 0.3 + avgPlating * 10) / 100;
    return { ...base, avgPlating, defenseRating };
  }, [placedParts]);

  const ensureApiKey = async () => {
    const aistudio = (window as any).aistudio;
    if (!aistudio) return;
    const hasKey = await aistudio.hasSelectedApiKey();
    if (!hasKey) {
      addLog("Credentials required for AI operations.", "WARNING");
      await aistudio.openSelectKey();
    }
  };

  const handleAiError = async (e: any) => {
    const aistudio = (window as any).aistudio;
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("API keys are not supported") || msg.includes("401") || msg.includes("UNAUTHENTICATED")) {
      addLog("Neural link blocked: Paid API key required.", "CRITICAL");
      if (aistudio) await aistudio.openSelectKey();
    } else {
      addLog("Neural buffer overflow or disruption.", "CRITICAL");
    }
  };

  const handlePlacePart = useCallback((pos: [number, number, number]) => {
    if (!selectedPart) return;
    const isColliding = placedParts.some(p => checkOverlap(pos, selectedPart.size, currentRotation, p.position, p.size, p.rotation));
    if (isColliding) {
      addLog("Volume Conflict: Alignment failed.", "WARNING");
      return;
    }
    const newParts = [...placedParts, { ...selectedPart, instanceId: crypto.randomUUID(), position: pos, rotation: currentRotation }];
    if (isSymmetryEnabled && pos[0] !== 0) {
      const mirroredPos: [number, number, number] = [-pos[0], pos[1], pos[2]];
      const isMirroredColliding = newParts.some(p => checkOverlap(mirroredPos, selectedPart.size, currentRotation, p.position, p.size, p.rotation));
      if (!isMirroredColliding) {
        newParts.push({ ...selectedPart, instanceId: crypto.randomUUID(), position: mirroredPos, rotation: currentRotation });
        addLog("Symmetry node synthesized.");
      }
    }
    setPlacedParts(newParts);
    addLog(`Module locked: ${selectedPart.name}`);
  }, [selectedPart, placedParts, isSymmetryEnabled, currentRotation, addLog]);

  const handleRemovePart = useCallback((instanceId: string) => {
    setPlacedParts(prev => prev.filter(p => p.instanceId !== instanceId));
    if (selectedInstanceId === instanceId) setSelectedInstanceId(null);
  }, [selectedInstanceId]);

  const handleForge = async (config: ForgeConfig) => {
    await ensureApiKey();
    const directive = (config.directive || '').trim() || 'No additional directive.';
    const forgeConfig: ForgeConfig = { ...config, directive };
    setIsForging(true);
    addLog(`Forge core active. Synthesizing ${forgeConfig.role}...`, "NEURAL");
    try {
      const blueprint = await generateShip(forgeConfig, AVAILABLE_PARTS);
      const newPlaced: PlacedPart[] = blueprint.map(bp => {
        const def = AVAILABLE_PARTS.find(p => p.id === bp.id) || AVAILABLE_PARTS[0];
        return { ...def, instanceId: crypto.randomUUID(), position: (bp.position as [number, number, number]) || [0, 0, 0], rotation: bp.rotation || 0 };
      });
      setPlacedParts(newPlaced);
      setIsForgeOpen(false);
      setHullVisuals(null);
      setConceptImageUrl(null);
      setVideoUrl(null);
      setAnalysis(null);
      setShipRotation(0);
      addLog(`Neural blueprint forged.`, "INFO");
    } catch (e) {
      handleAiError(e);
    } finally {
      setIsForging(false);
    }
  };

  const handleSynthesize = async () => {
    if (placedParts.length === 0) return;
    await ensureApiKey();
    setIsSynthesizing(true);
    addLog("Sequencing structural visuals...", "NEURAL");
    try {
      const visuals = await synthesizeHullVisuals(shipName, placedParts);
      setHullVisuals(visuals);
      setViewMode('SYNTHESIZED');
      addLog("Visual DNA synchronized.", "INFO");
    } catch (e) {
      handleAiError(e);
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleGenerateArt = async () => {
    if (!hullVisuals || placedParts.length === 0) return;
    await ensureApiKey();
    setIsGeneratingArt(true);
    addLog("Rendering cinematic concept art...", "NEURAL");
    try {
      const art = await generateConceptArt(shipName, hullVisuals, placedParts);
      setConceptImageUrl(art);
      addLog("Cinematic still ready.", "INFO");
    } catch (e) {
      handleAiError(e);
    } finally {
      setIsGeneratingArt(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!hullVisuals || placedParts.length === 0) return;
    await ensureApiKey();
    setVideoLoadingStatus("Allocating Veo synthesis cores...");
    try {
      const url = await generateShipVideo(shipName, hullVisuals, placedParts, (status) => {
        setVideoLoadingStatus(status);
        addLog(status, "NEURAL");
      });
      setVideoUrl(url);
      addLog("Video synthesis complete.", "INFO");
    } catch (e) {
      handleAiError(e);
    } finally {
      setVideoLoadingStatus(null);
    }
  };

  const handleSingleExport = async () => {
    const data = { name: shipName, stats, visuals: hullVisuals, parts: placedParts, conceptArt: conceptImageUrl, video: videoUrl, analysis, shipRotation, bridgeSnapshots: snapshots };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${shipName.replace(/\s+/g, '_')}_Manifest.json`;
    a.click();
    URL.revokeObjectURL(url);
    addLog("Vessel manifest exported.");
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.shiftKey && (e.key === 'r' || e.key === 'R')) { setShipRotation(prev => (prev + 90) % 360); return; }
      if (e.key === 'r' || e.key === 'R') { setCurrentRotation(prev => (prev + 90) % 360); addLog(`Rotation: ${((currentRotation + 90) % 360)}°`); }
      if (e.key === 's' || e.key === 'S') { setIsSymmetryEnabled(prev => !prev); addLog(`Symmetry: ${!isSymmetryEnabled ? 'ON' : 'OFF'}`); }
      if (e.key === 'Escape') { 
        setSelectedPartId(null); 
        setSelectedInstanceId(null); 
        setIsFleetOpen(false);
        setIsForgeOpen(false);
        setIsManualOpen(false);
        setAnalysis(null);
      }
      if (e.key === 'Delete' || e.key === 'Backspace') { if (selectedInstanceId) handleRemovePart(selectedInstanceId); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedInstanceId, handleRemovePart, currentRotation, isSymmetryEnabled, addLog, shipRotation]);

  const isCanvasPaused =
    isForgeOpen ||
    isForging ||
    isFleetOpen ||
    isManualOpen ||
    isAnalyzing ||
    !!analysis ||
    isSynthesizing ||
    isGeneratingArt ||
    !!videoLoadingStatus;

  return (
    <div className="relative flex w-full h-full overflow-hidden bg-slate-950 text-slate-100">
      <HUD 
        shipName={shipName}
        onNameChange={setShipName}
        viewMode={viewMode}
        onViewModeChange={(mode) => {
          if (mode === 'SYNTHESIZED' && !hullVisuals) handleSynthesize();
          else { setViewMode(mode); }
        }}
        currentFloor={currentFloor}
        onFloorChange={setCurrentFloor}
        isSymmetryEnabled={isSymmetryEnabled}
        onSymmetryToggle={() => setIsSymmetryEnabled(!isSymmetryEnabled)}
        shipRotation={shipRotation}
        onShipRotationChange={setShipRotation}
        isLaunchMode={isLaunchMode}
        onLaunchToggle={() => setIsLaunchMode(!isLaunchMode)}
        onAnalyze={async () => {
          await ensureApiKey();
          setIsAnalyzing(true);
          addLog("Computing design efficiency score...", "NEURAL");
          try { 
            const result = await analyzeShip(shipName, placedParts, stats);
            setAnalysis(result); 
          } catch (e) { handleAiError(e); }
          finally { setIsAnalyzing(false); }
        }}
        onForgeOpen={() => {
          if (document.pointerLockElement) document.exitPointerLock();
          setIsForgeOpen(true);
        }}
        onManualOpen={() => {
          if (document.pointerLockElement) document.exitPointerLock();
          setIsManualOpen(true);
        }}
        onFleetOpen={() => {
          if (document.pointerLockElement) document.exitPointerLock();
          setIsFleetOpen(true);
        }}
        onVideoGen={handleGenerateVideo}
        onArtGen={handleGenerateArt}
        onExport={handleSingleExport}
        hasHullVisuals={!!hullVisuals}
        hullVisuals={hullVisuals}
        onHullVisualsChange={setHullVisuals}
        logs={logs}
        hasSidebar={!isLaunchMode}
        onToggleBridgeCam={toggleBridgeCam}
        isBridgeCamActive={!!videoStream}
        onCaptureSnapshot={captureSnapshot}
        snapshots={snapshots}
        environmentConfig={environmentConfig}
        onEnvironmentConfigChange={setEnvironmentConfig}
      />

      {!isLaunchMode && (
        <ShipSidebar
          selectedPartId={selectedPartId}
          onSelectPart={setSelectedPartId}
          stats={stats}
        />
      )}

      <main className="flex-1 relative">
        <ShipCanvas 
          parts={placedParts || []}
          currentFloor={currentFloor}
          viewMode={viewMode}
          isLaunchMode={isLaunchMode}
          selectedInstanceId={selectedInstanceId}
          onPartClick={(id) => setSelectedInstanceId(id === selectedInstanceId ? null : id)}
          onGridClick={handlePlacePart}
          onDeselectAll={() => { setSelectedInstanceId(null); setSelectedPartId(null); }}
          hullVisuals={hullVisuals}
          selectedPart={selectedPart}
          currentRotation={currentRotation}
          shipRotation={shipRotation}
          videoStream={videoStream}
          environmentConfig={environmentConfig}
          isPaused={isCanvasPaused}
        />

        {(isSynthesizing || isGeneratingArt || videoLoadingStatus) && (
           <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 backdrop-blur-xl z-50">
              <div className="text-center p-12 glass-panel border-sky-500/40">
                 <div className="w-24 h-24 border-2 border-sky-500/20 border-t-sky-500 rounded-full animate-spin mx-auto mb-6"></div>
                 <div className="font-orbitron text-sky-400 text-xl tracking-widest animate-pulse uppercase">
                   {isSynthesizing ? "Designing Aesthetic Lattice" : isGeneratingArt ? "Projecting Cinematic Image" : "Temporal Frame Synthesis"}
                 </div>
                 <p className="text-slate-400 text-[10px] mt-4 uppercase tracking-[0.5em] font-bold">
                   {videoLoadingStatus || "Consulting Neural Archways"}
                 </p>
              </div>
           </div>
        )}

        {selectedInstanceId && !isLaunchMode && (
          <div className="absolute bottom-8 right-8 glass-panel p-4 animate-in fade-in slide-in-from-bottom-4 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
            <h4 className="text-xs text-sky-400 font-orbitron mb-2 uppercase tracking-widest font-bold">Module Authority</h4>
            <button onClick={() => handleRemovePart(selectedInstanceId)} className="px-6 py-2 bg-red-600/20 border border-red-500 text-red-400 text-xs rounded hover:bg-red-600 hover:text-white transition-all font-bold uppercase tracking-widest">
              Decommission
            </button>
          </div>
        )}
      </main>

      <AIModal analysis={analysis} loading={isAnalyzing} onClose={() => setAnalysis(null)} />
      <ForgeModal isOpen={isForgeOpen} onClose={() => setIsForgeOpen(false)} onForge={handleForge} loading={isForging} />
      <FleetModal 
        isOpen={isFleetOpen} 
        onClose={() => setIsFleetOpen(false)} 
        fleets={fleets}
        activeFleetId={activeFleetId}
        activeShipId={activeShipId}
        onSwitchFleet={handleSwitchFleet}
        onSwitchShip={handleSwitchShip}
        onCreateFleet={handleCreateNewFleet}
        onCreateShip={handleCreateNewShip}
        onDeleteShip={handleDeleteShip}
        onCloneShip={handleCloneShip}
        onExportFleet={() => {
            if (!activeFleet) return;
            const manifest: FleetManifest = { fleetName: activeFleet.name, ships: activeFleet.ships || [], exportedAt: Date.now() };
            const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `AstraForge_${activeFleet.name.replace(/\s+/g, '_')}.json`;
            a.click();
            URL.revokeObjectURL(url);
            addLog(`Fleet manifest ${activeFleet.name} exported.`);
        }}
      />
      <MetricsManual isOpen={isManualOpen} onClose={() => setIsManualOpen(false)} />
    </div>
  );
};

export default App;
