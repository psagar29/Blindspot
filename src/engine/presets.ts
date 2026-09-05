import type { SensorConfig } from '../../shared/contracts';

export const ENGINE_VERSION = 'ground-stereo-1.0.0';
export function createSensorConfig(presetId: SensorConfig['presetId'], version = 1): SensorConfig {
  if (!['baseline', 'higher_resolution', 'permissive'].includes(presetId)) throw new Error('Unsupported sensor preset');
  const high = presetId === 'higher_resolution';
  return {
    id: `config-${version}`, version, presetId,
    label: high ? 'Higher resolution' : presetId === 'permissive' ? 'Permissive threshold' : 'Baseline stereo',
    modelVersion: 'passive-stereo-1',
    sensors: [{ id: 'front-stereo', kind: 'passive_stereo_approximation',
      mount: { positionM: [0, 0.35, 0], orientation: [0, 0, 0, 1] },
      widthPx: high ? 320 : 160, heightPx: high ? 240 : 120,
      horizontalFovRad: Math.PI / 2, nearM: 0.05, farM: 12,
      minResolvableWidthPx: presetId === 'permissive' ? 0.5 : 1, textureDropoutEnabled: false }],
    assumptions: [
      'Declared passive stereo approximation, not a calibrated hardware model.',
      'Exact proxy depth and occlusion-tested cable samples. Splats are appearance only.',
      'Projected cable width threshold uses the actual simulated raster pixels.',
      'Opaque materials; no texture dropout or synthetic noise. Presets keep route, speed and geometry fixed.',
    ],
  };
}
