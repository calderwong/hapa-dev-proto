// @ts-nocheck
import React from 'react';
import { PetState } from './types';
import type { PetInstance } from './types';

interface PetProps {
    pet: PetInstance;
    onPetClick?: (petId: string) => void;
    onPetContextMenu?: (petId: string, e: React.MouseEvent) => void;
    onDragStart?: (e: React.DragEvent) => void;
    onDragEnd?: (e: React.DragEvent) => void;
    draggable?: boolean;
}

const Pet: React.FC<PetProps> = ({ pet, onPetClick, onPetContextMenu, onDragStart, onDragEnd, draggable = false }) => {
    // Map state to asset filename
    // We downloaded: black_idle.gif, black_walk.gif, black_run.gif, black_lie.gif

    let action = 'idle';
    if (pet.state === PetState.SitIdle) action = 'idle';
    else if (pet.state === PetState.WalkRight || pet.state === PetState.WalkLeft) action = 'walk';
    else if (pet.state === PetState.RunRight || pet.state === PetState.RunLeft) action = 'run';
    else if (pet.state === PetState.Lie) action = 'lie';
    else if (pet.state === PetState.Custom) action = 'custom';
    else if (pet.state === PetState.Special) action = 'special';

    // Construct path: /pets/{type}/{color}_{action}.gif
    // Example: /pets/dog/black_idle.gif
    let src = '';
    if (pet.config.type === 'custom' && pet.config.assets) {
        if (action === 'idle') src = pet.config.assets.idle;
        else if (action === 'walk') src = pet.config.assets.walk;
        else if (action === 'run') src = pet.config.assets.run;
        else if (action === 'lie') src = pet.config.assets.lie || pet.config.assets.idle;
        else if ((action === 'custom' || action === 'special') && pet.customAction) {
            // For special/custom actions, check modules first, then assets
            const moduleAsset = pet.config.modules?.[pet.customAction]?.assetUrl;
            src = moduleAsset || pet.config.assets[pet.customAction] || pet.config.assets.idle;
        }
        else src = pet.config.assets.idle;
    } else {
        src = `/pets/${pet.config.type}/${pet.config.color}_${action}.gif`;
    }

    // Check if pet has any click-triggered modules
    const hasClickTrigger = pet.config.modules && 
        Object.values(pet.config.modules).some(m => m.trigger === 'click' && m.assetUrl);

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onPetClick) {
            onPetClick(pet.config.id);
        }
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        if (!onPetContextMenu) return;
        e.preventDefault();
        e.stopPropagation();
        onPetContextMenu(pet.config.id, e);
    };

    const style: React.CSSProperties = {
        position: 'absolute',
        left: `${pet.position.x}px`,
        bottom: `${pet.position.y}px`,
        width: '64px', // Default size
        height: 'auto',
        transform: pet.position.direction === 'left' ? 'scaleX(-1)' : 'none',
        transition: 'left 0.1s linear', // Smooth movement
        imageRendering: 'pixelated', // Keep pixel art crisp
        cursor: hasClickTrigger ? 'pointer' : 'grab'
    };

    const handleDragStart = (e: React.DragEvent) => {
        if (onDragStart) {
            onDragStart(e);
        }
    };

    const handleDragEnd = (e: React.DragEvent) => {
        if (onDragEnd) {
            onDragEnd(e);
        }
    };

    return (
        <div 
            style={style} 
            title={`${pet.config.name} (${pet.state})${hasClickTrigger ? ' - Click me!' : ''}${draggable ? ' - Drag to move' : ''}`}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
            draggable={draggable}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            className={draggable ? 'cursor-grab active:cursor-grabbing' : ''}
        >
            <img
                src={src}
                alt={pet.config.name}
                style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
                draggable={false}
            />
            {/* Name tag */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] bg-black/50 text-white px-1 rounded whitespace-nowrap opacity-0 hover:opacity-100 transition-opacity">
                {pet.config.name}
            </div>
            {/* Click indicator for pets with click triggers */}
            {hasClickTrigger && pet.state !== PetState.Special && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-astro-primary rounded-full animate-pulse" title="Click to interact!"></div>
            )}
            {/* Drag indicator for draggable pets */}
            {draggable && (
                <div className="absolute -top-1 -left-1 w-3 h-3 bg-purple-500 rounded-full opacity-50" title="Drag me!"></div>
            )}
        </div>
    );
};

export default Pet;
