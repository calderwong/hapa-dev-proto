
import React, { useEffect, useState } from 'react';
import { EFFECTS_REGISTRY } from '../effects/registry';
import { EffectsDeckState, AudioStem } from '../types';
import { effectsService } from '../services/effectsService';

interface EffectsRendererProps {
    stems: AudioStem[];
    beat: number;
}

const EffectsRenderer: React.FC<EffectsRendererProps> = ({ stems, beat }) => {
    const [state, setState] = useState<EffectsDeckState>(effectsService.getState());

    useEffect(() => {
        // Poll for state changes since effectsService isn't an observable store yet
        const interval = setInterval(() => {
            setState({ ...effectsService.getState() });
        }, 100); // 10fps UI update is fine
        return () => clearInterval(interval);
    }, []);

    return (
        <group>
            {state.instances.map(inst => {
                if (!inst.enabled) return null;
                const def = EFFECTS_REGISTRY[inst.effectId];
                if (!def) return null;
                
                const Component = def.component;
                return (
                    <Component 
                        key={inst.instanceId} 
                        instance={inst} 
                        stems={stems} 
                        beat={beat} 
                    />
                );
            })}
        </group>
    );
};

export default EffectsRenderer;
