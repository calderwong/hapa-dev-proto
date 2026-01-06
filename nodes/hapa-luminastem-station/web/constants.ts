
export const FFT_SIZE = 512; // Power of 2
export const SMOOTHING_TIME_CONSTANT = 0.8;
export const STEM_COLORS = [
  '#00ff88', // Green
  '#00ccff', // Cyan
  '#ff0055', // Red/Pink
  '#ffcc00', // Yellow
  '#bd00ff', // Purple
  '#ff5500', // Orange
];

export const SIGIL_MAP_LOW = ["🌑", "🪨", "🌋", "⚓", "🧱", "🪵", "🐻", "🐢"];
export const SIGIL_MAP_MID = ["🌊", "🌲", "🍀", "👽", "🤖", "🧬", "🧶", "🎭"];
export const SIGIL_MAP_HIGH = ["✨", "⚡", "🛸", "💎", "🧚", "🐝", "💫", "🌟"];
export const SIGIL_MAP_FLUX = ["🌀", "🌪️", "🌊", "🔥", "💨", "🎢", "🚀", "☄️"];

export const MATH_EXPLANATION_prompt = `
You are a professor of Digital Signal Processing and Mathematics. 
Explain the math behind 3D Audio Visualization briefly (max 2 sentences).
Topics to randomly choose from:
1. Fast Fourier Transform (FFT) and how it converts time domain to frequency domain.
2. How amplitude modifies vertex displacement in a 3D mesh.
3. The relationship between sample rate and the Nyquist frequency.
4. How Decibels (dB) are a logarithmic unit relative to a reference.
5. Why we use smoothing constants in the analyser node for visual fluidity.
6. The geometry of a sphere and how normal vectors are used for lighting.
Make it sound futuristic and educational.
`;
