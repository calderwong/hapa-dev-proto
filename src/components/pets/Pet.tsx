// @ts-nocheck
import React from 'react';
import { PetState } from './types';
import type { PetInstance } from './types';

interface PetProps {
    pet: PetInstance;
}

const Pet: React.FC<PetProps> = ({ pet }) => {
    // Map state to asset filename
    // We downloaded: black_idle.gif, black_walk.gif, black_run.gif, black_lie.gif

    let action = 'idle';
    if (pet.state === PetState.SitIdle) action = 'idle';
    else if (pet.state === PetState.WalkRight || pet.state === PetState.WalkLeft) action = 'walk';
    else if (pet.state === PetState.RunRight || pet.state === PetState.RunLeft) action = 'run';
    else if (pet.state === PetState.Lie) action = 'lie';
    else if (pet.state === PetState.Custom) action = 'custom';

    // Construct path: /pets/{type}/{color}_{action}.gif
    // Example: /pets/dog/black_idle.gif
    let src = '';
    if (pet.config.type === 'custom' && pet.config.assets) {
        if (action === 'idle') src = pet.config.assets.idle;
        else if (action === 'walk') src = pet.config.assets.walk;
        else if (action === 'run') src = pet.config.assets.run;
        else if (action === 'lie') src = pet.config.assets.lie || pet.config.assets.idle;
        else if (action === 'custom' && pet.customAction) src = pet.config.assets[pet.customAction] || pet.config.assets.idle;
        else src = pet.config.assets.idle;
    } else {
        src = `/pets/${pet.config.type}/${pet.config.color}_${action}.gif`;
    }

    const style: React.CSSProperties = {
        position: 'absolute',
        left: `${pet.position.x}px`,
        bottom: `${pet.position.y}px`,
        width: '64px', // Default size
        height: 'auto',
        transform: pet.position.direction === 'left' ? 'scaleX(-1)' : 'none',
        transition: 'left 0.1s linear', // Smooth movement
        imageRendering: 'pixelated', // Keep pixel art crisp
        cursor: 'grab'
    };

    return (
        <div style={style} title={`${pet.config.name} (${pet.state})`}>
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
        </div>
    );
};

export default Pet;
