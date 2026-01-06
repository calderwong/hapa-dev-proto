
// Mulberry32 implementation for deterministic PRNG
class SeededPRNG {
    private seed: number;

    constructor(seedStr: string) {
        this.seed = this.hashString(seedStr);
    }

    private hashString(str: string): number {
        let h = 1779033703 ^ str.length;
        for (let i = 0; i < str.length; i++) {
            h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
            h = h << 13 | h >>> 19;
        }
        return function() {
            h = Math.imul(h ^ (h >>> 16), 2246822507);
            h = Math.imul(h ^ (h >>> 13), 3266489909);
            return (h ^= h >>> 16) >>> 0;
        }();
    }

    // Returns float between 0 and 1
    random(): number {
        let t = this.seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }

    // Range helper
    range(min: number, max: number): number {
        return min + this.random() * (max - min);
    }
}

export const createPRNG = (seed: string) => new SeededPRNG(seed);
