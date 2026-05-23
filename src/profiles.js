// ── STAGE PROFILES ───────────────────────────────────────────────────────────
export const STAGE_PROFILES = {
  ANR_CHENNAI: {
    id: 'ANR_CHENNAI',
    name: 'ANR VP Stage — Chennai',
    shortName: 'ANR',
    wall: {
      arcFt: 52, arcM: 15.85,
      chordFt: 48, chordM: 14.63,
      heightFt: 21, heightM: 6.40,
      radiusM: 10.5,
      arcDeg: 86.5,
      resW: 6912, resH: 2808,
      pixelPitch: 2.3,
      cabinet: 'AOTO RM 2.3',
    },
    sideWalls: {
      count: 6,
      eachFt: '3x8', widthM: 0.914, heightM: 2.438,
      resW: 432, resH: 1080,
    },
    ceiling: {
      partitions: 4,
      eachFt: '3x9', widthM: 0.914, heightM: 2.743,
      resW: 512, resH: 1536,
      pixelPitch: 3.7,
      cabinet: 'AOTO M3.7H',
    },
    safeDistanceM: 3.5,
    maxTrackVolumeM: 8,
  },
};

// ── PLATE CAMERA PROFILES ────────────────────────────────────────────────────
export const PLATE_CAMERAS = {
  IPHONE_17_PRO_MAX: {
    id: 'IPHONE_17_PRO_MAX',
    name: 'iPhone 17 Pro Max',
    shortName: 'iPhone 17PM',
    sensorW_mm: 8.0, sensorH_mm: 6.0,
    nativeFL_mm: 24,           // 24mm full-frame equivalent
    fovEquiv_deg: 73.7,        // native wide camera HFOV
    resW: 4032, resH: 3024,
    aspectRatio: '4:3',
    hasLiDAR: true,
    notes: 'Native 1x wide camera · 24mm FF equiv',
  },
  SONY_A7R4: {
    id: 'SONY_A7R4',
    name: 'Sony A7R IV',
    shortName: 'A7R IV',
    sensorW_mm: 35.7, sensorH_mm: 23.8,
    nativeFL_mm: 24,
    fovEquiv_deg: 73.7,
    resW: 9504, resH: 6336,
    aspectRatio: '3:2',
    hasLiDAR: false,
    notes: 'Full frame · 61MP · 24mm Canon EF via speedbooster',
  },
  SONY_A7S3: {
    id: 'SONY_A7S3',
    name: 'Sony A7S III',
    shortName: 'A7S III',
    sensorW_mm: 35.6, sensorH_mm: 23.8,
    nativeFL_mm: 24,
    fovEquiv_deg: 73.7,
    resW: 4240, resH: 2832,
    aspectRatio: '3:2',
    hasLiDAR: false,
    notes: 'Full frame · 12.1MP · Low light optimised',
  },
  RED_KOMODO_6K: {
    id: 'RED_KOMODO_6K',
    name: 'RED Komodo 6K',
    shortName: 'Komodo 6K',
    sensorW_mm: 27.03, sensorH_mm: 14.26,
    nativeFL_mm: 24,
    fovEquiv_deg: 60.2,        // 24mm on Super35 sensor
    resW: 6144, resH: 3240,
    aspectRatio: '17:9',
    hasLiDAR: false,
    notes: 'Super35 · 6K · Crop factor ~1.3x',
  },
};

// ── STAGE (ON-SET) CAMERA PROFILES ──────────────────────────────────────────
export const STAGE_CAMERAS = {
  URSA_12K_LF: {
    id: 'URSA_12K_LF',
    name: 'Blackmagic URSA Cine 12K LF',
    shortName: 'URSA 12K LF',
    sensorW_mm: 36.35, sensorH_mm: 25.45,
    resW: 12288, resH: 8640,
    notes: 'Large Format · Used on ANR stage',
  },
};

// ── LENS PRESETS ─────────────────────────────────────────────────────────────
export const LENS_PRESETS = [
  { fl: 24,  label: '24mm' },
  { fl: 35,  label: '35mm' },
  { fl: 50,  label: '50mm' },
  { fl: 85,  label: '85mm' },
  { fl: 135, label: '135mm' },
];

// ── GEOMETRY HELPERS ─────────────────────────────────────────────────────────
export function hfovRad(sensorW_mm, fl_mm) {
  return 2 * Math.atan(sensorW_mm / (2 * fl_mm));
}

export function vfovRad(sensorH_mm, fl_mm) {
  return 2 * Math.atan(sensorH_mm / (2 * fl_mm));
}

export function ftToM(ft) { return ft * 0.3048; }
export function mToFt(m)  { return m / 0.3048; }

export function cropRatio(plateHFOV_rad, stageHFOV_rad) {
  return Math.min(stageHFOV_rad / plateHFOV_rad, 1.0);
}

export function wallCoverage(stageHFOV_rad, camToWall_m, wallChord_m) {
  const visibleWidth = 2 * camToWall_m * Math.tan(stageHFOV_rad / 2);
  return Math.min(visibleWidth / wallChord_m, 1.5); // allow over 100% to show spill
}

export function safetyRating(cr, wallCov) {
  if (wallCov > 1.0)   return { label: 'INVALID', color: '#FF3B30' };
  if (cr > 0.95)       return { label: 'RISKY',   color: '#FF9500' };
  if (cr > 0.82)       return { label: 'TIGHT',   color: '#FFD60A' };
  return               { label: 'SAFE',    color: '#30D158' };
}
