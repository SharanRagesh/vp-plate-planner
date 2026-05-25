// Unreal-style translucent green LED volume shader for techvis wall
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

/** Techvis green (matches Unreal LED volume preview) */
export const LED_WALL_GREEN = new THREE.Color(0x22ff55);
export const LED_WALL_EDGE = new THREE.Color(0x66ff99);

const VERT = /* glsl */`
varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec2 vUv;

void main() {
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = -mvPosition.xyz;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const FRAG = /* glsl */`
uniform float uTime;
uniform vec3 uColor;
uniform vec3 uEmissive;
uniform float uOpacity;
uniform float uRows;
uniform float uCols;

varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec2 vUv;

void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(vViewPosition);
  float fresnel = pow(1.0 - max(dot(n, v), 0.0), 2.2);

  // LED pixel rows (RM 2.3 ~ 2.3mm pitch → fine horizontal bands)
  float rowBand = sin(vUv.y * uRows * 6.28318 + uTime * 0.4) * 0.5 + 0.5;
  rowBand = mix(0.72, 1.0, rowBand);

  // Cabinet column seams
  float colSeam = smoothstep(0.88, 0.96, fract(vUv.x * uCols));
  float colGlow = colSeam * 0.35;

  // Soft vignette on wall edges
  float edgeU = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
  float edgeV = smoothstep(0.0, 0.04, vUv.y) * smoothstep(1.0, 0.96, vUv.y);
  float vignette = edgeU * edgeV;

  vec3 base = uColor * rowBand * vignette;
  vec3 glow = uEmissive * (fresnel * 0.55 + 0.2 + colGlow);
  vec3 finalColor = base + glow;

  float alpha = uOpacity * (0.28 + fresnel * 0.42) * vignette;
  gl_FragColor = vec4(finalColor, clamp(alpha, 0.0, 0.85));
}
`;

/**
 * @param {object} opts
 * @param {number} [opts.rows] LED rows across wall height (6912×2808 → ~2.46 aspect)
 * @param {number} [opts.cols] Cabinet columns along arc
 */
export function createLedWallMaterial(opts = {}) {
  const rows = opts.rows ?? 280;
  const cols = opts.cols ?? 48;

  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: LED_WALL_GREEN.clone() },
      uEmissive: { value: new THREE.Color(0x44ff88) },
      uOpacity: { value: 0.52 },
      uRows: { value: rows },
      uCols: { value: cols },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}

/** Bright green wireframe edges like Unreal techvis outline */
export function createLedWallEdgeMaterial() {
  return new THREE.LineBasicMaterial({
    color: LED_WALL_EDGE,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
  });
}

export function tickLedWallMaterial(mat, timeSec) {
  if (mat?.uniforms?.uTime) mat.uniforms.uTime.value = timeSec;
}
