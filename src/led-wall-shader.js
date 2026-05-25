// Unreal-style translucent green LED volume
import * as THREE from '../vendor/three/build/three.module.js';

export const LED_WALL_GREEN = new THREE.Color(0x22ff55);

const VERT = /* glsl */`
varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = -mv.xyz;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */`
uniform float uTime;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uRows;
varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec2 vUv;
void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(vViewPosition);
  float fresnel = pow(1.0 - max(dot(n, v), 0.0), 2.0);
  float rowBand = sin(vUv.y * uRows * 6.28318) * 0.5 + 0.5;
  rowBand = mix(0.78, 1.0, rowBand);
  vec3 col = uColor * rowBand * (0.85 + fresnel * 0.35);
  float alpha = uOpacity * (0.32 + fresnel * 0.38);
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.72));
}
`;

export function createLedWallMaterial(opts = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: LED_WALL_GREEN.clone() },
      uOpacity: { value: 0.48 },
      uRows: { value: opts.rows ?? 200 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

export function tickLedWallMaterial(mat, t) {
  if (mat?.uniforms?.uTime) mat.uniforms.uTime.value = t;
}
