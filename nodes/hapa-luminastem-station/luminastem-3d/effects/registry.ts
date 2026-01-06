
import { EffectDefinition } from '../types';
import { ParticleTrail, BeatPulseLight, CameraOrbitRig, ZoomHit, ColorGradeShift } from './EffectImpls';

export const EFFECTS_REGISTRY: Record<string, EffectDefinition> = {
    'particle_trail': {
        id: 'particle_trail',
        name: 'Particle Trail',
        description: 'Emits particles from active stems.',
        component: ParticleTrail,
        params: {
            count: { name: 'Count', type: 'number', default: 5, min: 1, max: 20 },
            speed: { name: 'Speed', type: 'number', default: 1, min: 0.1, max: 5 },
            size: { name: 'Size', type: 'number', default: 0.2, min: 0.05, max: 1 },
            color: { name: 'Color', type: 'color', default: '#00ff88' }
        }
    },
    'beat_pulse_light': {
        id: 'beat_pulse_light',
        name: 'Beat Pulse Light',
        description: 'Flashes a point light on beat.',
        component: BeatPulseLight,
        params: {
            intensity: { name: 'Intensity', type: 'number', default: 2, min: 0, max: 10 },
            decay: { name: 'Decay Speed', type: 'number', default: 5, min: 1, max: 20 },
            color: { name: 'Color', type: 'color', default: '#ffffff' }
        }
    },
    'camera_orbit_rig': {
        id: 'camera_orbit_rig',
        name: 'Orbit Rig',
        description: 'Auto-orbit camera.',
        component: CameraOrbitRig,
        params: {
            radius: { name: 'Radius', type: 'number', default: 40, min: 10, max: 100 },
            height: { name: 'Height', type: 'number', default: 20, min: -50, max: 50 },
            speed: { name: 'Speed', type: 'number', default: 2, min: 0, max: 10 },
            lookAtY: { name: 'LookAt Y', type: 'number', default: 0, min: -20, max: 20 }
        }
    },
    'zoom_hit': {
        id: 'zoom_hit',
        name: 'Zoom Hit',
        description: 'Camera zoom punch on beat.',
        component: ZoomHit,
        params: {
            amount: { name: 'Punch Amount', type: 'number', default: 10, min: 1, max: 30 },
            recovery: { name: 'Recovery', type: 'number', default: 5, min: 1, max: 20 }
        }
    },
    'color_grade': {
        id: 'color_grade',
        name: 'Color Shift',
        description: 'Cycles background color.',
        component: ColorGradeShift,
        params: {
            speed: { name: 'Speed', type: 'number', default: 0.1, min: 0, max: 2 },
            saturation: { name: 'Saturation', type: 'number', default: 0.5, min: 0, max: 1 }
        }
    }
};
