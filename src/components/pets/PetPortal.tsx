// @ts-nocheck
/**
 * PetPortal - A mini pet habitat in the header
 * Pets can be dragged here from the Sanctuary or Card Library
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { PetCard, PetInstance, PetConfig, EnvironmentTheme, PetZone } from './types';
import { PetState } from './types';
import { HeaderPetController } from './HeaderPetController';
import { 
  loadPetsByZone, 
  updatePetLocation, 
  petCardToConfig,
  parsePetDragData,
  hasPetDragData,
  ENVIRONMENT_THEMES 
} from '../../utils/petCardUtils';

// Mini pet renderer for header
const MiniPet: React.FC<{ 
  pet: PetInstance; 
  onDragStart?: (pet: PetInstance, e: React.DragEvent) => void;
}> = ({ pet, onDragStart }) => {
  let action = 'idle';
  if (pet.state === PetState.WalkRight || pet.state === PetState.WalkLeft) action = 'walk';
  if (pet.state === PetState.RunRight || pet.state === PetState.RunLeft) action = 'run';

  let src = '';
  if (pet.config.type === 'custom' && pet.config.assets) {
    src = pet.config.assets[action] || pet.config.assets.idle;
  } else {
    src = `/pets/${pet.config.type}/${pet.config.color}_${action}.gif`;
  }

  const handleDragStart = (e: React.DragEvent) => {
    if (onDragStart) {
      onDragStart(pet, e);
    }
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="absolute cursor-grab active:cursor-grabbing transition-none" // Removed transition for smooth physics
      style={{
        left: `${pet.position.x}px`,
        bottom: `${pet.position.y + 2}px`, // Apply Y position from physics
        transform: pet.position.direction === 'left' ? 'scaleX(-1)' : 'none',
      }}
      title={`${pet.config.name} - Drag to move`}
    >
      <img
        src={src}
        alt={pet.config.name}
        className="w-7 h-7 object-contain pointer-events-none"
        style={{ imageRendering: 'pixelated' }}
        draggable={false}
      />
    </div>
  );
};

// Special scene for Sunny Meadow
const MeadowScene: React.FC = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden">
    {/* Horizon/Sky gradient overlay to soften */}
    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#87CEEB]/20" />
    
    {/* 3D Ground Plane */}
    <div 
      className="absolute bottom-0 left-0 right-0 h-[40%]"
      style={{ 
        background: 'linear-gradient(to bottom, #5a9c6f 0%, #3a7c4f 100%)',
        transform: 'perspective(100px) rotateX(10deg) scaleY(1.5) translateY(2px)',
        transformOrigin: 'bottom'
      }}
    />

    {/* Tree - Left side background */}
    <div className="absolute bottom-[35%] left-[8%] opacity-90" style={{ transform: 'scale(0.6)' }}>
      <svg width="24" height="32" viewBox="0 0 24 32" fill="none">
        {/* Trunk */}
        <path d="M10 22h4v10h-4z" fill="#5D4037" />
        {/* Leaves */}
        <path d="M12 2L2 16h6v6h-4l8 10 8-10h-4v-6h6L12 2z" fill="#2E7D32" />
        <path d="M12 2L2 16h6v6h-4l8 10 8-10h-4v-6h6L12 2z" fill="rgba(0,0,0,0.1)" style={{ mixBlendMode: 'overlay' }} />
      </svg>
    </div>

    {/* Campfire Scene - Center */}
    <div className="absolute bottom-[25%] left-1/2 -translate-x-1/2 flex items-end justify-center" style={{ transform: 'scale(0.7)' }}>
      {/* Back Chair */}
      <div className="absolute -top-3 opacity-80">
         <svg width="16" height="16" viewBox="0 0 16 16">
            <rect x="4" y="6" width="8" height="8" fill="#8D6E63" rx="1" />
            <rect x="5" y="14" width="1" height="2" fill="#5D4037" />
            <rect x="10" y="14" width="1" height="2" fill="#5D4037" />
         </svg>
      </div>

      {/* Fire */}
      <div className="relative z-10 mb-1">
        {/* Logs */}
        <svg width="24" height="8" viewBox="0 0 24 8" className="absolute bottom-0 left-1/2 -translate-x-1/2">
           <path d="M2 6l20 0" stroke="#5D4037" strokeWidth="2" strokeLinecap="round" />
           <path d="M5 7l14 -3" stroke="#4E342E" strokeWidth="2" strokeLinecap="round" />
           <path d="M5 2l14 5" stroke="#3E2723" strokeWidth="2" strokeLinecap="round" />
        </svg>
        
        {/* Flames - Layered Animation */}
        <div className="relative w-6 h-8 -mt-2">
            {/* Outer Glow */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-6 bg-orange-600/40 rounded-full blur-sm animate-pulse" />
            
            {/* Main Flame */}
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-3 h-5 bg-gradient-to-t from-red-500 via-orange-500 to-yellow-400 rounded-full blur-[0.5px] animate-bounce" style={{ animationDuration: '0.6s' }} />
            
            {/* Inner Flame (Flicker) */}
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-2 h-3 bg-yellow-300 rounded-full animate-pulse" style={{ animationDuration: '0.2s' }} />
            
            {/* Sparks */}
            <div className="absolute bottom-4 left-1/2 w-0.5 h-0.5 bg-yellow-200 rounded-full animate-ping" style={{ animationDuration: '1.5s', animationDelay: '0.1s' }} />
            <div className="absolute bottom-3 left-[60%] w-0.5 h-0.5 bg-orange-300 rounded-full animate-ping" style={{ animationDuration: '1.2s', animationDelay: '0.5s' }} />
        </div>
      </div>

      {/* Left Chair */}
      <div className="absolute -left-8 bottom-0">
         <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M4 8h8v6h-8z" fill="#8D6E63" transform="skewY(-10)" />
            <path d="M4 14h1v2h-1z" fill="#5D4037" />
            <path d="M11 14h1v2h-1z" fill="#5D4037" />
         </svg>
      </div>

      {/* Right Chair */}
      <div className="absolute -right-8 bottom-0">
         <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M4 8h8v6h-8z" fill="#8D6E63" transform="skewY(10)" />
            <path d="M4 14h1v2h-1z" fill="#5D4037" />
            <path d="M11 14h1v2h-1z" fill="#5D4037" />
         </svg>
      </div>
    </div>
  </div>
);

interface PetPortalProps {
  onPetDropped?: (petCard: PetCard) => void;
  onPetRemoved?: (petCard: PetCard) => void;
}

const PetPortal: React.FC<PetPortalProps> = ({ onPetDropped, onPetRemoved }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<HeaderPetController | null>(null);
  const [pets, setPets] = useState<PetInstance[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [theme, setTheme] = useState<EnvironmentTheme>(ENVIRONMENT_THEMES[0]);
  const [petCards, setPetCards] = useState<Map<string, PetCard>>(new Map());

  // Initialize controller and load pets
  useEffect(() => {
    if (!containerRef.current) return;

    const { clientWidth, clientHeight } = containerRef.current;
    controllerRef.current = new HeaderPetController(clientWidth, clientHeight, theme);

    // Load pets in header zone
    loadPetsByZone('header').then((headerPets) => {
      const cardMap = new Map<string, PetCard>();
      headerPets.forEach((petCard) => {
        cardMap.set(petCard.id, petCard);
        const config = petCardToConfig(petCard);
        controllerRef.current?.addPet(config, { 
          cardId: petCard.id, 
          coreName: petCard.coreName 
        });
      });
      setPetCards(cardMap);
      setPets([...controllerRef.current?.getPets() || []]);
    });

    // Game loop - 30fps for smooth physics
    const interval = setInterval(() => {
      if (controllerRef.current) {
        controllerRef.current.tick();
        setPets([...controllerRef.current.getPets()]);
      }
    }, 33);

    // Resize handler
    const handleResize = () => {
      if (containerRef.current && controllerRef.current) {
        controllerRef.current.updateDimensions(
          containerRef.current.clientWidth,
          containerRef.current.clientHeight
        );
      }
    };
    
    window.addEventListener('resize', handleResize);

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', handleResize);
    };
  }, []); // Run once on mount

  // Update environment when theme changes
  useEffect(() => {
    if (controllerRef.current) {
      controllerRef.current.setEnvironment(theme);
    }
  }, [theme]);

  // Handle pet drag from portal to remove/return to sanctuary
  const handlePetDragStart = useCallback((pet: PetInstance, e: React.DragEvent) => {
    const petCard = petCards.get(pet.id);
    if (!petCard) return;

    const dragData = JSON.stringify({
      type: 'pet-card',
      petId: petCard.id,
      coreName: petCard.coreName,
      sourceZone: 'header',
      petCard,
    });

    e.dataTransfer.setData('application/x-pet-card', dragData);
    e.dataTransfer.setData('application/json', dragData);
    e.dataTransfer.effectAllowed = 'move';
  }, [petCards]);

  // Handle drop - add pet to portal
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const parsed = parsePetDragData(e.dataTransfer);
    if (!parsed) return;

    const { petCard, sourceZone } = parsed;
    
    // Don't re-add if already in header
    if (sourceZone === 'header') return;

    // Update pet location to header
    const updatedCard = await updatePetLocation(petCard, 'header');
    if (updatedCard && controllerRef.current) {
      const config = petCardToConfig(updatedCard);
      controllerRef.current.addPet(config, {
        cardId: updatedCard.id,
        coreName: updatedCard.coreName,
      });
      
      setPetCards(prev => new Map(prev).set(updatedCard.id, updatedCard));
      setPets([...controllerRef.current.getPets()]);
      
      onPetDropped?.(updatedCard);
    }
  }, [onPetDropped]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (hasPetDragData(e.dataTransfer)) {
      e.dataTransfer.dropEffect = 'move';
    }
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (hasPetDragData(e.dataTransfer)) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    // Only set false if leaving the container entirely
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  // Theme cycling
  const cycleTheme = () => {
    const currentIndex = ENVIRONMENT_THEMES.findIndex(t => t.id === theme.id);
    const nextIndex = (currentIndex + 1) % ENVIRONMENT_THEMES.length;
    setTheme(ENVIRONMENT_THEMES[nextIndex]);
  };

  return (
    <div
      ref={containerRef}
      className={`
        relative h-9 w-48 mx-2 rounded-md overflow-hidden
        border transition-all duration-200 cursor-pointer
        ${isDragOver 
          ? 'border-astro-primary shadow-[0_0_12px_rgba(77,184,255,0.5)] scale-105' 
          : 'border-gray-700/50 hover:border-gray-600'
        }
      `}
      style={{ background: theme.background }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onClick={cycleTheme}
      title={`Pet Portal - ${theme.name} (click to change)`}
    >
      {/* Render custom meadow scene or standard ground line */}
      {theme.id === 'meadow' ? (
        <MeadowScene />
      ) : (
        <div 
          className="absolute bottom-0 left-0 right-0 h-1"
          style={{ backgroundColor: theme.groundColor }}
        />
      )}

      {/* Ambient particles for night/space themes */}
      {theme.ambientParticles && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute w-0.5 h-0.5 bg-white rounded-full animate-pulse" style={{ top: '20%', left: '10%' }} />
          <div className="absolute w-0.5 h-0.5 bg-white rounded-full animate-pulse" style={{ top: '40%', left: '30%', animationDelay: '0.5s' }} />
          <div className="absolute w-0.5 h-0.5 bg-white rounded-full animate-pulse" style={{ top: '15%', left: '60%', animationDelay: '1s' }} />
          <div className="absolute w-0.5 h-0.5 bg-white rounded-full animate-pulse" style={{ top: '50%', left: '80%', animationDelay: '0.3s' }} />
          <div className="absolute w-0.5 h-0.5 bg-white rounded-full animate-pulse" style={{ top: '30%', left: '90%', animationDelay: '0.7s' }} />
        </div>
      )}

      {/* Drop zone indicator */}
      {isDragOver && (
        <div className="absolute inset-0 bg-astro-primary/20 flex items-center justify-center pointer-events-none">
          <span className="text-[10px] font-bold text-white drop-shadow-lg">
            DROP HERE
          </span>
        </div>
      )}

      {/* Pets */}
      {pets.map(pet => (
        <MiniPet 
          key={pet.id} 
          pet={pet} 
          onDragStart={handlePetDragStart}
        />
      ))}

      {/* Empty state */}
      {pets.length === 0 && !isDragOver && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[9px] text-white/40 font-medium">
            Drag a pet here
          </span>
        </div>
      )}
    </div>
  );
};

export default PetPortal;
