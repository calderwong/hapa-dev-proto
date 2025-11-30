// Web Audio API context (lazy initialized)
let audioCtx: AudioContext | null = null;
let isMuted = localStorage.getItem('hapa-audio-muted') === 'true';

const getAudioContext = () => {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtx;
};

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
    gain.connect(ctx.destination);

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
