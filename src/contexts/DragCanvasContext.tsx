import React, { createContext, useContext, useState, useCallback } from 'react';

export interface DragItem {
  id: string;
  type: string;
  data: any;
  render: (data: any) => React.ReactNode;
  initialRect: DOMRect;
  startX: number;
  startY: number;
  pointerId?: number; // For transferring drag
  onClick?: (e: React.MouseEvent | React.PointerEvent | PointerEvent) => void; // For handling clicks
}

export interface SnapZone {
  id: string;
  rect: { left: number; top: number; width: number; height: number }; // standard object, not DOMRect instance
  threshold: number; // distance in px to trigger snap
  onSnap: (item: DragItem) => void;
}

interface DragCanvasContextType {
  items: DragItem[];
  spawnItem: (item: DragItem) => void;
  removeItem: (id: string) => void;
  registerSnapZone: (zone: SnapZone) => void;
  unregisterSnapZone: (id: string) => void;
  snapZones: SnapZone[];
}

const DragCanvasContext = createContext<DragCanvasContextType | undefined>(undefined);

export const DragCanvasProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<DragItem[]>([]);
  const [snapZones, setSnapZones] = useState<SnapZone[]>([]);

  const spawnItem = useCallback((item: DragItem) => {
    setItems(prev => [...prev, item]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const registerSnapZone = useCallback((zone: SnapZone) => {
    setSnapZones(prev => {
      // update if exists, else add
      const idx = prev.findIndex(z => z.id === zone.id);
      if (idx >= 0) {
        const newZones = [...prev];
        newZones[idx] = zone;
        return newZones;
      }
      return [...prev, zone];
    });
  }, []);

  const unregisterSnapZone = useCallback((id: string) => {
    setSnapZones(prev => prev.filter(z => z.id !== id));
  }, []);

  return (
    <DragCanvasContext.Provider 
      value={{ 
        items,
        spawnItem,
        removeItem,
        registerSnapZone,
        unregisterSnapZone,
        snapZones
      }}
    >
      {children}
    </DragCanvasContext.Provider>
  );
};

export const useDragCanvas = () => {
  const context = useContext(DragCanvasContext);
  if (!context) {
    throw new Error('useDragCanvas must be used within a DragCanvasProvider');
  }
  return context;
};
