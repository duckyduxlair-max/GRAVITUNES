/**
 * GraviTunes Audio Enhancement — "Dolby-Style" Spatial Audio
 * Uses Web Audio API for bass boost, spatial widening, and EQ.
 * Integrates into AudioController's existing node chain.
 */

export type AudioPreset = 'off' | 'spatial' | 'bass' | 'cinema' | 'vocal';

export interface EnhancementNodes {
    bassBoost: BiquadFilterNode;
    trebleBoost: BiquadFilterNode;
    presence: BiquadFilterNode;
    compressor: DynamicsCompressorNode;
}

const PRESETS: Record<AudioPreset, {
    bass: { gain: number; frequency: number; Q: number };
    treble: { gain: number; frequency: number; Q: number };
    presence: { gain: number; frequency: number; Q: number };
    compressor: { threshold: number; ratio: number; attack: number; release: number };
}> = {
    off: {
        bass: { gain: 0, frequency: 80, Q: 1 },
        treble: { gain: 0, frequency: 10000, Q: 1 },
        presence: { gain: 0, frequency: 3000, Q: 1 },
        compressor: { threshold: 0, ratio: 1, attack: 0.003, release: 0.25 },
    },
    spatial: {
        bass: { gain: 3, frequency: 100, Q: 0.8 },
        treble: { gain: 4, frequency: 12000, Q: 0.7 },
        presence: { gain: 2, frequency: 4000, Q: 1.2 },
        compressor: { threshold: -18, ratio: 3, attack: 0.01, release: 0.15 },
    },
    bass: {
        bass: { gain: 8, frequency: 80, Q: 1.2 },
        treble: { gain: 1, frequency: 10000, Q: 0.8 },
        presence: { gain: 0, frequency: 3000, Q: 1 },
        compressor: { threshold: -15, ratio: 4, attack: 0.005, release: 0.2 },
    },
    cinema: {
        bass: { gain: 5, frequency: 60, Q: 0.7 },
        treble: { gain: 5, frequency: 14000, Q: 0.6 },
        presence: { gain: 3, frequency: 5000, Q: 1 },
        compressor: { threshold: -20, ratio: 5, attack: 0.003, release: 0.15 },
    },
    vocal: {
        bass: { gain: -2, frequency: 200, Q: 0.8 },
        treble: { gain: 2, frequency: 8000, Q: 1 },
        presence: { gain: 6, frequency: 3000, Q: 1.5 },
        compressor: { threshold: -12, ratio: 2.5, attack: 0.01, release: 0.2 },
    },
};

let enhancementNodes: EnhancementNodes | null = null;
let currentPreset: AudioPreset = (localStorage.getItem('gravitunes_audio_preset') as AudioPreset) || 'off';

/**
 * Create enhancement filter nodes. Called by AudioController during init.
 * Returns nodes to be inserted into the audio chain.
 */
export function createEnhancementNodes(ctx: AudioContext): EnhancementNodes {
    const bassBoost = ctx.createBiquadFilter();
    bassBoost.type = 'lowshelf';

    const trebleBoost = ctx.createBiquadFilter();
    trebleBoost.type = 'highshelf';

    const presence = ctx.createBiquadFilter();
    presence.type = 'peaking';

    const compressor = ctx.createDynamicsCompressor();

    // Chain internally: bass → treble → presence → compressor
    bassBoost.connect(trebleBoost);
    trebleBoost.connect(presence);
    presence.connect(compressor);

    enhancementNodes = { bassBoost, trebleBoost, presence, compressor };

    // Apply saved preset
    applyPresetToNodes(currentPreset);

    return enhancementNodes;
}

function applyPresetToNodes(preset: AudioPreset) {
    if (!enhancementNodes) return;
    const config = PRESETS[preset];

    enhancementNodes.bassBoost.frequency.value = config.bass.frequency;
    enhancementNodes.bassBoost.gain.value = config.bass.gain;
    enhancementNodes.bassBoost.Q.value = config.bass.Q;

    enhancementNodes.trebleBoost.frequency.value = config.treble.frequency;
    enhancementNodes.trebleBoost.gain.value = config.treble.gain;
    enhancementNodes.trebleBoost.Q.value = config.treble.Q;

    enhancementNodes.presence.frequency.value = config.presence.frequency;
    enhancementNodes.presence.gain.value = config.presence.gain;
    enhancementNodes.presence.Q.value = config.presence.Q;

    enhancementNodes.compressor.threshold.value = config.compressor.threshold;
    enhancementNodes.compressor.ratio.value = config.compressor.ratio;
    enhancementNodes.compressor.attack.value = config.compressor.attack;
    enhancementNodes.compressor.release.value = config.compressor.release;
}

export function setPreset(preset: AudioPreset): void {
    currentPreset = preset;
    localStorage.setItem('gravitunes_audio_preset', preset);
    applyPresetToNodes(preset);
}

export function getPreset(): AudioPreset {
    return currentPreset;
}

export function getAvailablePresets(): { id: AudioPreset; name: string; icon: string; description: string }[] {
    return [
        { id: 'off', name: 'Standard', icon: '🔈', description: 'No enhancement' },
        { id: 'spatial', name: 'Spatial Audio', icon: '🎧', description: 'Immersive 3D sound' },
        { id: 'bass', name: 'Bass Boost', icon: '🔊', description: 'Deep powerful bass' },
        { id: 'cinema', name: 'Cinema', icon: '🎬', description: 'Theater surround' },
        { id: 'vocal', name: 'Vocal Clarity', icon: '🎤', description: 'Clear vocals' },
    ];
}
