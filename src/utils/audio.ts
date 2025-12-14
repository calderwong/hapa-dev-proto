// Web Audio API context (lazy initialized)
let audioCtx: AudioContext | null = null;
let isMuted = localStorage.getItem('hapa-audio-muted') === 'true';

let masterGain: GainNode | null = null;
let masterCompressor: DynamicsCompressorNode | null = null;

const getAudioContext = () => {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtx;
};

const getMasterOutput = (ctx: AudioContext) => {
    if (!masterGain || !masterCompressor) {
        masterGain = ctx.createGain();
        masterCompressor = ctx.createDynamicsCompressor();

        masterCompressor.threshold.setValueAtTime(-24, ctx.currentTime);
        masterCompressor.knee.setValueAtTime(20, ctx.currentTime);
        masterCompressor.ratio.setValueAtTime(6, ctx.currentTime);
        masterCompressor.attack.setValueAtTime(0.003, ctx.currentTime);
        masterCompressor.release.setValueAtTime(0.12, ctx.currentTime);

        masterGain.gain.setValueAtTime(0.85, ctx.currentTime);

        masterGain.connect(masterCompressor);
        masterCompressor.connect(ctx.destination);
    }
    return masterGain;
};

const vary = (base: number, amount: number) => base * (1 + (Math.random() * 2 - 1) * amount);

export const toggleMute = () => {
    isMuted = !isMuted;
    localStorage.setItem('hapa-audio-muted', String(isMuted));
    return isMuted;
};

export const getMuteState = () => isMuted;

const createTone = (
    ctx: AudioContext,
    {
        type,
        startFreq,
        endFreq,
        duration,
        startGain = 0.04,
        endGain = 0.001,
    }: {
        type: OscillatorType;
        startFreq: number;
        endFreq: number;
        duration: number;
        startGain?: number;
        endGain?: number;
    },
) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(getMasterOutput(ctx));

    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + duration);

    gain.gain.setValueAtTime(startGain, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(endGain, ctx.currentTime + duration);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
};

export const playHoverSound = () => {
    if (isMuted) return;
    try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') {
            ctx.resume();
        }
        createTone(ctx, {
            type: 'sine',
            startFreq: 800,
            endFreq: 1200,
            duration: 0.05,
            startGain: 0.03,
        });
    } catch (e) {
        console.error('Audio play failed', e);
    }
};

export const playCardPortalSound = (mode: 'blue' | 'red' = 'blue') => {
    if (isMuted) return;
    try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') ctx.resume();
        if (mode === 'red') {
            createTone(ctx, {
                type: 'sawtooth',
                startFreq: vary(840, 0.01),
                endFreq: vary(160, 0.01),
                duration: 0.11,
                startGain: 0.05,
            });
            createTone(ctx, {
                type: 'sine',
                startFreq: vary(1100, 0.01),
                endFreq: vary(460, 0.01),
                duration: 0.085,
                startGain: 0.018,
            });
        } else {
            createTone(ctx, {
                type: 'sawtooth',
                startFreq: vary(980, 0.01),
                endFreq: vary(220, 0.01),
                duration: 0.12,
                startGain: 0.04,
            });
            createTone(ctx, {
                type: 'sine',
                startFreq: vary(1400, 0.01),
                endFreq: vary(700, 0.01),
                duration: 0.09,
                startGain: 0.016,
            });
        }
    } catch (e) {
        console.error('Audio play failed', e);
    }
};

export const playClickSound = () => {
    if (isMuted) return;
    try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') {
            ctx.resume();
        }
        createTone(ctx, {
            type: 'square',
            startFreq: 600,
            endFreq: 300,
            duration: 0.08,
            startGain: 0.05,
        });
    } catch (e) {
        console.error('Audio play failed', e);
    }
};

export const playDropdownOpenSound = () => {
    if (isMuted) return;
    try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') ctx.resume();
        createTone(ctx, {
            type: 'triangle',
            startFreq: 500,
            endFreq: 700,
            duration: 0.12,
            startGain: 0.04,
        });
    } catch (e) {
        console.error('Audio play failed', e);
    }
};

export const playDropdownHoverSound = () => {
    if (isMuted) return;
    try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') ctx.resume();
        createTone(ctx, {
            type: 'sine',
            startFreq: 650,
            endFreq: 900,
            duration: 0.05,
            startGain: 0.025,
        });
    } catch (e) {
        console.error('Audio play failed', e);
    }
};

export const playDropdownSelectSound = () => {
    if (isMuted) return;
    try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') ctx.resume();
        createTone(ctx, {
            type: 'sawtooth',
            startFreq: 900,
            endFreq: 500,
            duration: 0.1,
            startGain: 0.045,
        });
    } catch (e) {
        console.error('Audio play failed', e);
    }
};

export const playPickUpSound = () => {
    if (isMuted) return;
    try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') ctx.resume();
        createTone(ctx, {
            type: 'triangle',
            startFreq: 400,
            endFreq: 800,
            duration: 0.15,
            startGain: 0.06,
        });
    } catch (e) {
        console.error('Audio play failed', e);
    }
};

export const playDropSound = () => {
    if (isMuted) return;
    try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') ctx.resume();
        createTone(ctx, {
            type: 'square',
            startFreq: 300,
            endFreq: 80,
            duration: 0.15,
            startGain: 0.08,
        });
    } catch (e) {
        console.error('Audio play failed', e);
    }
};

export const playCardPickUpSound = () => {
    if (isMuted) return;
    try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') ctx.resume();
        createTone(ctx, {
            type: 'triangle',
            startFreq: 420,
            endFreq: 980,
            duration: 0.09,
            startGain: 0.055,
        });
    } catch (e) {
        console.error('Audio play failed', e);
    }
};

export const playCardClickSound = () => {
    if (isMuted) return;
    try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') ctx.resume();
        createTone(ctx, {
            type: 'sine',
            startFreq: 900,
            endFreq: 520,
            duration: 0.05,
            startGain: 0.035,
        });
    } catch (e) {
        console.error('Audio play failed', e);
    }
};

export const playCardMoveTickSound = () => {
    if (isMuted) return;
    try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') ctx.resume();
        const start = vary(620, 0.02);
        const end = vary(740, 0.02);
        createTone(ctx, {
            type: 'sine',
            startFreq: start,
            endFreq: end,
            duration: 0.018,
            startGain: 0.012,
        });
    } catch (e) {
        console.error('Audio play failed', e);
    }
};

export const playCardDepthNudgeSound = (direction: 'in' | 'out') => {
    if (isMuted) return;
    try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') ctx.resume();
        const up = direction === 'in';
        const start = vary(up ? 760 : 680, 0.015);
        const end = vary(up ? 980 : 520, 0.015);
        createTone(ctx, {
            type: 'triangle',
            startFreq: start,
            endFreq: end,
            duration: 0.03,
            startGain: 0.02,
        });
    } catch (e) {
        console.error('Audio play failed', e);
    }
};

export const playCardDropSound = () => {
    if (isMuted) return;
    try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') ctx.resume();
        createTone(ctx, {
            type: 'square',
            startFreq: 260,
            endFreq: 95,
            duration: 0.11,
            startGain: 0.06,
        });
    } catch (e) {
        console.error('Audio play failed', e);
    }
};

export const playCardSnapSound = () => {
    if (isMuted) return;
    try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') ctx.resume();
        createTone(ctx, {
            type: 'sawtooth',
            startFreq: 520,
            endFreq: 940,
            duration: 0.06,
            startGain: 0.035,
        });
        createTone(ctx, {
            type: 'sine',
            startFreq: 1200,
            endFreq: 840,
            duration: 0.05,
            startGain: 0.018,
        });
    } catch (e) {
        console.error('Audio play failed', e);
    }
};

export const playForgeHoverSound = () => {
    if (isMuted) return;
    try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') ctx.resume();
        createTone(ctx, {
            type: 'sawtooth',
            startFreq: 1200,
            endFreq: 1400,
            duration: 0.03,
            startGain: 0.015,
        });
    } catch (e) {
        console.error('Audio play failed', e);
    }
};
