
import { EffectsDeckState, EffectInstance, EffectPreset } from '../types';
import { EFFECTS_REGISTRY } from '../effects/registry';
import { v4 as uuidv4 } from 'uuid';
import { sessionService } from './sessionService';

class EffectsService {
    private state: EffectsDeckState = {
        sessionSeed: "lumina_default",
        instances: []
    };

    constructor() {
        // Initialize default instances (disabled by default)
        Object.values(EFFECTS_REGISTRY).forEach(def => {
            this.addInstance(def.id, false);
        });
    }

    getState() { return this.state; }

    setState(newState: EffectsDeckState) {
        this.state = newState;
        // Trigger UI update if needed (via event or React polling)
    }

    addInstance(effectId: string, enabled: boolean = false) {
        const def = EFFECTS_REGISTRY[effectId];
        if (!def) return;

        const defaultParams: any = {};
        for (const [key, schema] of Object.entries(def.params)) {
            defaultParams[key] = schema.default;
        }

        const instance: EffectInstance = {
            instanceId: uuidv4(),
            effectId,
            enabled,
            params: defaultParams,
            seed: uuidv4() // Unique seed per instance
        };

        this.state.instances.push(instance);
        sessionService.logEvent('EFFECT_INSTANCE_ADD', { instanceId: instance.instanceId, effectId });
        return instance;
    }

    updateParam(instanceId: string, param: string, value: any) {
        const instance = this.state.instances.find(i => i.instanceId === instanceId);
        if (instance) {
            instance.params[param] = value;
            // Debounce logging in real app, here we log everything for correctness
            sessionService.logEvent('EFFECT_PARAM_UPDATE', { instanceId, param, value });
        }
    }

    setEnabled(instanceId: string, enabled: boolean) {
        const instance = this.state.instances.find(i => i.instanceId === instanceId);
        if (instance) {
            instance.enabled = enabled;
            sessionService.logEvent('EFFECT_PARAM_UPDATE', { instanceId, param: 'enabled', value: enabled });
        }
    }

    savePreset(name: string): EffectPreset {
        const preset: EffectPreset = {
            id: uuidv4(),
            name,
            instances: this.state.instances.map(i => ({
                instanceId: i.instanceId, // Reuse ID logic or new? 
                // Actually preset should describe CONFIG not instances.
                // But for simplicity, let's snapshot the current setup.
                effectId: i.effectId,
                enabled: i.enabled,
                params: { ...i.params }
            }))
        };
        sessionService.logEvent('EFFECT_PRESET_SAVED', { presetId: preset.id, name });
        // In a real app, save to library. Here just return it.
        return preset;
    }

    applyPreset(preset: EffectPreset) {
        // Replace current params with preset params
        // We match by effectId (assuming singleton effect instances for now, or match by order?)
        // Let's assume one instance per effect type for this MVP.
        
        preset.instances.forEach(pInst => {
            const existing = this.state.instances.find(i => i.effectId === pInst.effectId);
            if (existing) {
                existing.enabled = pInst.enabled;
                existing.params = { ...pInst.params };
            }
        });
        
        this.state.activePresetId = preset.id;
        sessionService.logEvent('EFFECT_PRESET_APPLIED', { presetId: preset.id });
    }
    
    // For Keyframe restoration
    restoreState(snapshotState: EffectsDeckState) {
        // Deep copy to avoid ref issues
        this.state = JSON.parse(JSON.stringify(snapshotState));
    }
}

export const effectsService = new EffectsService();
