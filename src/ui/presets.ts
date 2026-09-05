import type { SensorConfig } from "../../shared/contracts";

/** UI display catalogue for the three allowlisted presets (frozen in the
 * contract). Qualitative copy only; exact sensor parameters always come from
 * the bridge's SensorConfig so the UI never invents numbers. */
export const PRESET_DISPLAY: Record<
  SensorConfig["presetId"],
  { label: string; blurb: string }
> = {
  baseline: {
    label: "Baseline stereo",
    blurb: "Reference stereo pair and support threshold.",
  },
  higher_resolution: {
    label: "Higher resolution",
    blurb: "Same optics with a denser raster; thin targets resolve earlier.",
  },
  permissive: {
    label: "Permissive threshold",
    blurb: "Accepts weaker support; may trade false stops for coverage.",
  },
};

export const PRESET_IDS = Object.keys(PRESET_DISPLAY) as ReadonlyArray<SensorConfig["presetId"]>;
