// ── Simplified 3D techvis: green LED wall arc + on-set frustum on wall ───────
import * as THREE from '../vendor/three/build/three.module.js';
import { hfovRad, vfovRad, cropRatio, wallCoverage, safetyRating } from './profiles.js';
import { createLedWallMaterial, tickLedWallMaterial } from './led-wall-shader.js';

const DEG = Math.PI / 180;
const FRUSTUM_COLOR = 0xffe135; // amber — distinct from green wall

export class AREngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.running = false;
    this.visible = true;

    this.alpha = 0;
    this.beta = 0;
    this.gamma = 0;

    this.wallLocked = false;
    this._anchorQuat = new THREE.Quaternion();
    this._deviceQuat = new THREE.Quaternion();
    this._euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this._iosFix = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0), -Math.PI / 2,
    );

    this.wallDist_m = null;
    this.currentFL = 50;
    this.camToChar_m = 6.1;
    this.charToWall_m = 3.96;
    this.camHeight_m = 1.55;
    this.stageProfile = null;
    this.plateCamera = null;
    this.stageCamera = null;

    this._clock = new THREE.Clock();
    this._frame = this._frame.bind(this);
    this._initRenderer();
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);

    this.scene = new THREE.Scene();
    this.world = new THREE.Group();
    this.scene.add(this.world);

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.05, 350);
    this.camera.position.set(0, this.camHeight_m, 0);

    this.stageGroup = new THREE.Group();
    this.world.add(this.stageGroup);

    this.meshes = { wall: new THREE.Group(), frustum: new THREE.Group() };
    this.stageGroup.add(this.meshes.wall, this.meshes.frustum);

    this.mats = {
      wall: createLedWallMaterial({ rows: 200, cols: 48 }),
      frustum: new THREE.LineBasicMaterial({
        color: FRUSTUM_COLOR,
        linewidth: 2,
        transparent: true,
        opacity: 0.95,
      }),
      frustumRay: new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.35,
      }),
    };
  }

  start() {
    this.running = true;
    this.resize();
    requestAnimationFrame(this._frame);
  }

  stop() { this.running = false; }

  resize() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    this.renderer.setSize(W, H, false);
    const hFov = (this.plateCamera?.fovEquiv_deg ?? 65) * DEG;
    const vFov = 2 * Math.atan(Math.tan(hFov / 2) / (W / H));
    this.camera.fov = (vFov * 180) / Math.PI;
    this.camera.aspect = W / H;
    this.camera.updateProjectionMatrix();
  }

  onOrientation(alpha, beta, gamma) {
    this.alpha = alpha * DEG;
    this.beta = beta * DEG;
    this.gamma = gamma * DEG;
  }

  _deviceQuaternion() {
    this._euler.set(this.beta, this.alpha, -this.gamma, 'YXZ');
    this._deviceQuat.setFromEuler(this._euler);
    this._deviceQuat.multiply(this._iosFix);
    return this._deviceQuat;
  }

  lockWallAnchor(dist_m, anchorQuat = null) {
    this.wallDist_m = dist_m;
    this.wallLocked = true;
    this._anchorQuat.copy(anchorQuat || this._deviceQuaternion());
    this._rebuildStage();
    return true;
  }

  unlockWall() {
    this.wallLocked = false;
    this.wallDist_m = null;
    this._rebuildStage();
  }

  setDistances(camToTalent_m, talentToWall_m) {
    this.camToChar_m = camToTalent_m;
    this.charToWall_m = talentToWall_m;
    this.wallDist_m = camToTalent_m + talentToWall_m;
    this._rebuildStage();
  }

  _clearGroup(group) {
    while (group.children.length) {
      const c = group.children[0];
      group.remove(c);
      if (c.geometry) c.geometry.dispose();
    }
  }

  _rebuildStage() {
    if (!this.stageProfile) return;
    this._clearGroup(this.meshes.wall);
    this._clearGroup(this.meshes.frustum);

    const wall = this.stageProfile.wall;
    const camToW = this.wallDist_m ?? (this.camToChar_m + this.charToWall_m);
    const chH = this.camHeight_m;
    const fl = this.currentFL;
    const stageHFOV = this.stageCamera
      ? hfovRad(this.stageCamera.sensorW_mm, fl) : 0.7;
    const stageVFOV = this.stageCamera
      ? vfovRad(this.stageCamera.sensorH_mm, fl) : 0.5;

    const wallY0 = 0;
    const wallY1 = wall.heightM;
    const wallZ = -camToW;
    const R = wall.radiusM;
    const halfArc = (wall.arcDeg / 2) * DEG;
    const arcSegs = 56;

    const arcCenterZ = wallZ + R;
    const arcRow = (y) => {
      const pts = [];
      for (let i = 0; i <= arcSegs; i++) {
        const t = (i / arcSegs) * 2 - 1;
        const theta = t * halfArc;
        pts.push(
          new THREE.Vector3(
            R * Math.sin(theta),
            y,
            arcCenterZ - R * Math.cos(theta),
          ),
        );
      }
      return pts;
    };

    // Green LED wall surface
    const bottom = arcRow(wallY0);
    const top = arcRow(wallY1);
    const positions = [];
    const uvs = [];
    const indices = [];
    for (let i = 0; i < arcSegs; i++) {
      const u0 = i / arcSegs;
      const u1 = (i + 1) / arcSegs;
      const b0 = bottom[i];
      const b1 = bottom[i + 1];
      const t0 = top[i];
      const t1 = top[i + 1];
      const base = positions.length / 3;
      for (const p of [b0, b1, t1, t0]) {
        positions.push(p.x, p.y, p.z);
      }
      uvs.push(u0, 0, u1, 0, u1, 1, u0, 1);
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    const wallGeo = new THREE.BufferGeometry();
    wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    wallGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    wallGeo.setIndex(indices);
    wallGeo.computeVertexNormals();
    this.meshes.wall.add(new THREE.Mesh(wallGeo, this.mats.wall));

    // Top + bottom wall curves only
    for (const row of [bottom, top]) {
      this.meshes.wall.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(row),
          new THREE.LineBasicMaterial({ color: 0x66ff99, transparent: true, opacity: 0.9 }),
        ),
      );
    }

    // On-set frustum rectangle projected ON the wall (scales with lens + cam→wall)
    const hw = Math.tan(stageHFOV / 2) * camToW;
    const hh = Math.tan(stageVFOV / 2) * camToW;
    const yMid = chH;
    const yBot = Math.max(wallY0 + 0.05, yMid - hh);
    const yTop = Math.min(wallY1 - 0.05, yMid + hh);

    const frustumCorners = [
      new THREE.Vector3(-hw, yTop, wallZ),
      new THREE.Vector3(hw, yTop, wallZ),
      new THREE.Vector3(hw, yBot, wallZ),
      new THREE.Vector3(-hw, yBot, wallZ),
    ];
    const loop = [...frustumCorners, frustumCorners[0]];
    this.meshes.frustum.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(loop),
        this.mats.frustum,
      ),
    );

    // Subtle sight lines from camera to frustum corners
    const cam = new THREE.Vector3(0, chH, 0);
    const rays = [];
    for (const c of frustumCorners) {
      rays.push(cam, c);
    }
    this.meshes.frustum.add(
      new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(rays),
        this.mats.frustumRay,
      ),
    );
  }

  _updateCameraPose() {
    const q = this._deviceQuaternion();
    this.camera.quaternion.copy(q);
    if (!this.wallLocked) {
      this.world.quaternion.copy(q).invert();
    } else {
      this.world.quaternion.copy(this._anchorQuat).invert().multiply(q);
    }
    this.world.position.set(0, 0, 0);
  }

  _frame() {
    if (!this.running) return;
    if (this.visible && this.stageProfile) {
      tickLedWallMaterial(this.mats.wall, this._clock.getElapsedTime());
      this._updateCameraPose();
      this.renderer.render(this.scene, this.camera);
    } else {
      this.renderer.clear();
    }
    requestAnimationFrame(this._frame);
  }

  /** Force a frame before export capture */
  forceRender() {
    if (!this.stageProfile) return;
    tickLedWallMaterial(this.mats.wall, this._clock.getElapsedTime());
    this._updateCameraPose();
    this.renderer.render(this.scene, this.camera);
  }

  refreshScene() {
    const w = this.stageProfile?.wall;
    if (w?.resH && this.mats.wall?.uniforms) {
      this.mats.wall.uniforms.uRows.value = Math.min(w.resH / 8, 320);
      this.mats.wall.uniforms.uCols.value = Math.min(w.resW / 144, 64);
    }
    this._rebuildStage();
  }

  getSafety() {
    if (!this.stageProfile) return { label: '—', color: '#888' };
    const camToW = this.wallDist_m ?? (this.camToChar_m + this.charToWall_m);
    const fl = this.currentFL;
    const plateHFOV = this.plateCamera?.fovEquiv_deg * DEG || 1.29;
    const stageHFOV = this.stageCamera
      ? hfovRad(this.stageCamera.sensorW_mm, fl) : 0.7;
    const cr = cropRatio(plateHFOV, stageHFOV);
    const wc = wallCoverage(stageHFOV, camToW, this.stageProfile.wall.chordM);
    return safetyRating(cr, wc);
  }
}
