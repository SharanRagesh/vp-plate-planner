// ── 3D AR VIEWPORT (Three.js) ───────────────────────────────────────────────
// Renders stage geometry in perspective through the phone camera, like Unreal techvis.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { hfovRad, vfovRad, cropRatio, wallCoverage,
         safetyRating, mToFt } from './profiles.js';

const DEG = Math.PI / 180;
const COLORS = {
  wall: 0xff5c35,
  plate: 0x3a9ee8,
  crop: 0x00e5a0,
  talent: 0xa78bfa,
  ground: 0x1a2332,
  grid: 0x2a3548,
};

export class AREngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.running = false;
    this.visible = true;

    this.alpha = 0;
    this.beta = 0;
    this.gamma = 0;

    this.wallLocked = false;
    this.anchorAlpha = 0;
    this.anchorBeta = 0;
    this.anchorGamma = 0;
    this._anchorQuat = new THREE.Quaternion();
    this._deviceQuat = new THREE.Quaternion();
    this._euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this._iosFix = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0), -Math.PI / 2
    );

    this.wallDist_m = null;
    this.currentFL = 50;
    this.camToChar_m = 6.1;
    this.charToWall_m = 3.96;
    this.camHeight_m = 1.55;
    this.stageProfile = null;
    this.plateCamera = null;
    this.stageCamera = null;

    this._frame = this._frame.bind(this);
    this._initRenderer();
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x000000, 0.018);

    this.world = new THREE.Group();
    this.scene.add(this.world);

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.05, 350);
    this.camera.position.set(0, this.camHeight_m, 0);

    this.stageGroup = new THREE.Group();
    this.world.add(this.stageGroup);

    this._buildMaterials();
    this._buildStageMeshes();
    this._addLights();
  }

  _buildMaterials() {
    const wallMat = () => new THREE.MeshBasicMaterial({
      color: COLORS.wall,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.mats = {
      wall: wallMat(),
      wallEdge: new THREE.LineBasicMaterial({ color: COLORS.wall, linewidth: 2 }),
      wallEdgeDim: new THREE.LineBasicMaterial({ color: COLORS.wall, transparent: true, opacity: 0.55 }),
      plate: new THREE.MeshBasicMaterial({
        color: COLORS.plate,
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
      plateLine: new THREE.LineBasicMaterial({ color: COLORS.plate, transparent: true, opacity: 0.85 }),
      crop: new THREE.MeshBasicMaterial({
        color: COLORS.crop,
        transparent: true,
        opacity: 0.14,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
      cropLine: new THREE.LineBasicMaterial({ color: COLORS.crop }),
      talent: new THREE.MeshBasicMaterial({
        color: COLORS.talent,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
      talentLine: new THREE.LineBasicMaterial({ color: COLORS.talent }),
      ground: new THREE.MeshBasicMaterial({
        color: COLORS.ground,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
      grid: new THREE.LineBasicMaterial({ color: COLORS.grid, transparent: true, opacity: 0.35 }),
    };
  }

  _buildStageMeshes() {
    this.meshes = {
      wall: new THREE.Group(),
      plateFrustum: new THREE.Group(),
      cropFrustum: new THREE.Group(),
      talent: new THREE.Group(),
      ground: new THREE.Group(),
    };
    this.stageGroup.add(
      this.meshes.ground,
      this.meshes.wall,
      this.meshes.plateFrustum,
      this.meshes.cropFrustum,
      this.meshes.talent,
    );
  }

  _addLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const dir = new THREE.DirectionalLight(0xffffff, 0.35);
    dir.position.set(2, 8, 4);
    this.scene.add(dir);
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
    this._updateCameraFov(W / H);
  }

  _updateCameraFov(aspect) {
    const hFov = (this.plateCamera?.fovEquiv_deg ?? 65) * DEG;
    const vFov = 2 * Math.atan(Math.tan(hFov / 2) / aspect);
    this.camera.fov = (vFov * 180) / Math.PI;
    this.camera.aspect = aspect;
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

  lockWallAnchor(dist_m) {
    this.wallDist_m = dist_m;
    this.wallLocked = true;
    this.anchorAlpha = this.alpha;
    this.anchorBeta = this.beta;
    this.anchorGamma = this.gamma;
    this._anchorQuat.copy(this._deviceQuaternion());
    this._rebuildStage();
    return true;
  }

  unlockWall() {
    this.wallLocked = false;
    this.wallDist_m = null;
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
    this._clearGroup(this.meshes.plateFrustum);
    this._clearGroup(this.meshes.cropFrustum);
    this._clearGroup(this.meshes.talent);
    this._clearGroup(this.meshes.ground);

    const wall = this.stageProfile.wall;
    const camToW = this.wallDist_m ?? (this.camToChar_m + this.charToWall_m);
    const camToC = this.camToChar_m;
    const chH = this.camHeight_m;
    const fl = this.currentFL;

    const stageHFOV = this.stageCamera
      ? hfovRad(this.stageCamera.sensorW_mm, fl) : 0.7;
    const stageVFOV = this.stageCamera
      ? vfovRad(this.stageCamera.sensorH_mm, fl) : 0.5;
    const plateHFOV = this.plateCamera
      ? this.plateCamera.fovEquiv_deg * DEG : 1.29;
    const plateVFOV = 2 * Math.atan(Math.tan(plateHFOV / 2) * 0.75);

    const wallY0 = 0;
    const wallY1 = wall.heightM;
    const wallZ = -camToW;
    const R = wall.radiusM;
    const halfArc = (wall.arcDeg / 2) * DEG;
    const arcSegs = 48;

    // ── Ground plane + grid (depth cue like Unreal viewport) ───────────────
    const groundGeo = new THREE.PlaneGeometry(80, 80);
    const ground = new THREE.Mesh(groundGeo, this.mats.ground);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = wallY0;
    this.meshes.ground.add(ground);

    const grid = new THREE.GridHelper(60, 30, COLORS.grid, COLORS.grid);
    grid.position.y = wallY0 + 0.02;
    this.meshes.ground.add(grid);

    // ── LED wall: curved mesh panels + wireframe ───────────────────────────
    const arcCenterZ = wallZ + R;
    const buildArcSurface = (y) => {
      const verts = [];
      for (let i = 0; i <= arcSegs; i++) {
        const t = (i / arcSegs) * 2 - 1;
        const theta = t * halfArc;
        const x = R * Math.sin(theta);
        const z = arcCenterZ - R * Math.cos(theta);
        verts.push(x, y, z);
      }
      return verts;
    };

    const bottom = buildArcSurface(wallY0);
    const top = buildArcSurface(wallY1);
    const positions = [];
    const indices = [];
    for (let i = 0; i < arcSegs; i++) {
      const bi = i * 3;
      const ti = (arcSegs + 1 + i) * 3;
      const b0 = bottom.slice(bi, bi + 3);
      const b1 = bottom.slice(bi + 3, bi + 6);
      const t0 = top.slice(bi, bi + 3);
      const t1 = top.slice(bi + 3, bi + 6);
      const base = positions.length / 3;
      positions.push(...b0, ...b1, ...t1, ...t0);
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    const wallGeo = new THREE.BufferGeometry();
    wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    wallGeo.setIndex(indices);
    wallGeo.computeVertexNormals();
    const wallMesh = new THREE.Mesh(wallGeo, this.mats.wall);
    this.meshes.wall.add(wallMesh);

    const edgePts = [];
    for (const y of [wallY0, wallY1]) {
      const row = buildArcSurface(y);
      for (let i = 0; i < row.length; i += 3) {
        edgePts.push(new THREE.Vector3(row[i], row[i + 1], row[i + 2]));
      }
    }
    const edgeGeo = new THREE.BufferGeometry().setFromPoints(edgePts);
    const edgeLine = new THREE.Line(edgeGeo, this.mats.wallEdge);
    this.meshes.wall.add(edgeLine);

    // Vertical chord edges at wall plane
    const chordHalf = wall.chordM / 2;
    const sideVerts = [
      new THREE.Vector3(-chordHalf, wallY0, wallZ),
      new THREE.Vector3(-chordHalf, wallY1, wallZ),
      new THREE.Vector3(chordHalf, wallY0, wallZ),
      new THREE.Vector3(chordHalf, wallY1, wallZ),
    ];
    const sideGeo = new THREE.BufferGeometry().setFromPoints([
      sideVerts[0], sideVerts[1],
      sideVerts[2], sideVerts[3],
    ]);
    const sideLine = new THREE.LineSegments(sideGeo, this.mats.wallEdgeDim);
    this.meshes.wall.add(sideLine);

    // ── Plate + crop frustums (3D cones to wall distance) ──────────────────
    const addFrustum = (group, hFov, vFov, colorMat, lineMat, dist) => {
      const hw = Math.tan(hFov / 2) * dist;
      const hh = Math.tan(vFov / 2) * dist;
      const z = -dist;
      const corners = [
        new THREE.Vector3(-hw, chH + hh, z),
        new THREE.Vector3(hw, chH + hh, z),
        new THREE.Vector3(hw, chH - hh, z),
        new THREE.Vector3(-hw, chH - hh, z),
      ];
      const cam = new THREE.Vector3(0, chH, 0);
      const faces = new THREE.BufferGeometry();
      const fPos = [];
      for (let i = 0; i < 4; i++) {
        const a = corners[i];
        const b = corners[(i + 1) % 4];
        fPos.push(cam.x, cam.y, cam.z, a.x, a.y, a.z, b.x, b.y, b.z);
      }
      faces.setAttribute('position', new THREE.Float32BufferAttribute(fPos, 3));
      group.add(new THREE.Mesh(faces, colorMat));

      const lines = [];
      for (const c of corners) lines.push(cam, c);
      for (let i = 0; i < 4; i++) lines.push(corners[i], corners[(i + 1) % 4]);
      const lineGeo = new THREE.BufferGeometry().setFromPoints(lines);
      group.add(new THREE.LineSegments(lineGeo, lineMat));
    };

    addFrustum(
      this.meshes.plateFrustum,
      plateHFOV,
      plateVFOV,
      this.mats.plate,
      this.mats.plateLine,
      camToW,
    );
    addFrustum(
      this.meshes.cropFrustum,
      stageHFOV,
      stageVFOV,
      this.mats.crop,
      this.mats.cropLine,
      camToW,
    );

    // ── Talent zone at cam→talent depth ────────────────────────────────────
    const tZ = -camToC;
    const tHalf = Math.tan(stageHFOV / 2) * camToC * 0.45;
    const tY0 = 0;
    const tY1 = 1.75;

    const talentPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(tHalf * 2, 0.08),
      this.mats.talent,
    );
    talentPlane.position.set(0, 0.04, tZ);
    talentPlane.rotation.x = -Math.PI / 2;
    this.meshes.talent.add(talentPlane);

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.28, 1.55, 10),
      this.mats.talent,
    );
    body.position.set(0, tY0 + 0.85, tZ);
    this.meshes.talent.add(body);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 12, 10),
      this.mats.talent,
    );
    head.position.set(0, tY1 - 0.1, tZ);
    this.meshes.talent.add(head);

    const talentWire = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(tHalf * 2, 1.75, 0.5)),
      this.mats.talentLine,
    );
    talentWire.position.set(0, tY0 + 0.88, tZ);
    this.meshes.talent.add(talentWire);
  }

  _updateCameraPose() {
    const q = this._deviceQuaternion();
    if (!this.wallLocked) {
      // Preview: LED wall stays centred in view while you aim to lock
      this.camera.quaternion.copy(q);
      this.world.quaternion.copy(q).invert();
      return;
    }

    // Locked: world stays fixed in real space; phone rotation pans the view
    this.camera.quaternion.copy(q);
    const invAnchor = this._anchorQuat.clone().invert();
    this.world.quaternion.copy(this._anchorQuat).invert().multiply(q);
    this.world.position.set(0, 0, 0);
  }

  _frame() {
    if (!this.running) return;
    if (this.visible && this.stageProfile) {
      this._updateCameraPose();
      this.renderer.render(this.scene, this.camera);
    } else {
      this.renderer.clear();
    }
    requestAnimationFrame(this._frame);
  }

  /** Called when lens or distances change */
  refreshScene() {
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
