import { create } from 'zustand';

export type ViewMode = 'constellation' | 'focus' | 'theatre' | 'lineage' | 'badges';

export interface CardPosition {
    cardId: string;
    position: [number, number, number];
    rotation: [number, number, number];
    scale: number;
}

interface Viewer3DState {
    // View
    viewMode: ViewMode;
    focusedCardId: string | null;
    selectedCardIds: string[];
    isOpen: boolean;
    
    // Camera
    cameraPosition: [number, number, number];
    cameraTarget: [number, number, number];
    cameraTransitioning: boolean;
    
    // Media
    playingVideoIds: string[];
    globalMuted: boolean;
    
    // Performance
    lodLevel: 'high' | 'medium' | 'low';
    particlesEnabled: boolean;
    
    // Card positions (calculated)
    cardPositions: Map<string, CardPosition>;
    
    // Actions
    setOpen: (open: boolean) => void;
    focusCard: (cardId: string) => void;
    setViewMode: (mode: ViewMode) => void;
    setCameraPosition: (position: [number, number, number]) => void;
    setCameraTarget: (target: [number, number, number]) => void;
    setGlobalMuted: (muted: boolean) => void;
    setCardPositions: (positions: Map<string, CardPosition>) => void;
    playVideo: (videoId: string) => void;
    stopVideo: (videoId: string) => void;
    resetView: () => void;
}

const DEFAULT_CAMERA_POSITION: [number, number, number] = [0, 0, 8];
const DEFAULT_CAMERA_TARGET: [number, number, number] = [0, 0, 0];

export const useViewer3DStore = create<Viewer3DState>((set, get) => ({
    // Initial state
    viewMode: 'focus',
    focusedCardId: null,
    selectedCardIds: [],
    isOpen: false,
    
    cameraPosition: DEFAULT_CAMERA_POSITION,
    cameraTarget: DEFAULT_CAMERA_TARGET,
    cameraTransitioning: false,
    
    playingVideoIds: [],
    globalMuted: true,
    
    lodLevel: 'high',
    particlesEnabled: true,
    
    cardPositions: new Map(),
    
    // Actions
    setOpen: (open) => set({ isOpen: open }),
    
    focusCard: (cardId) => set({ 
        focusedCardId: cardId,
        cameraTransitioning: true,
    }),
    
    setViewMode: (mode) => {
        const positions = calculatePositionsForMode(mode, get().focusedCardId);
        set({ 
            viewMode: mode,
            cameraTransitioning: true,
        });
    },
    
    setCameraPosition: (position) => set({ cameraPosition: position }),
    setCameraTarget: (target) => set({ cameraTarget: target }),
    
    setGlobalMuted: (muted) => {
        set({ globalMuted: muted });
        localStorage.setItem('globalMuted', String(muted));
    },
    
    setCardPositions: (positions) => set({ cardPositions: positions }),
    
    playVideo: (videoId) => set((state) => ({
        playingVideoIds: [...state.playingVideoIds, videoId],
    })),
    
    stopVideo: (videoId) => set((state) => ({
        playingVideoIds: state.playingVideoIds.filter(id => id !== videoId),
    })),
    
    resetView: () => set({
        cameraPosition: DEFAULT_CAMERA_POSITION,
        cameraTarget: DEFAULT_CAMERA_TARGET,
        viewMode: 'focus',
        cameraTransitioning: true,
    }),
}));

// Helper function to calculate card positions based on view mode
function calculatePositionsForMode(mode: ViewMode, focusedCardId: string | null): Map<string, CardPosition> {
    const positions = new Map<string, CardPosition>();
    // Will be implemented when we have cards data
    return positions;
}
