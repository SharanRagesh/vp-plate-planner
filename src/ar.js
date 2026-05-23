// ── AR OVERLAY ENGINE ────────────────────────────────────────────────────────
import { hfovRad, vfovRad, cropRatio, wallCoverage,
         safetyRating, mToFt } from './profiles.js';

export class AREngine {
  constructor(canvas) {
    this.canvas   = canvas;
    this.ctx      = canvas.getContext('2d');
    this.running  = false;
    this.visible  = true;

    // Device orientation (radians)
    this.alpha = 0; this.beta = 0; this.gamma = 0;

    // Anchor state
    this.wallLocked   = false;
    this.anchorAlpha  = 0; this.anchorBeta = 0; this.anchorGamma = 0;
    this.wallDist_m   = null;

    // Scene params
    this.currentFL     = 50;
    this.camToChar_m   = 6.1;   // 20ft default
    this.charToWall_m  = 3.96;  // 13ft default
    this.camHeight_m   = 1.55;
    this.stageProfile  = null;
    this.plateCamera   = null;
    this.stageCamera   = null;

    this._frame = this._frame.bind(this);
  }

  // ── LIFECYCLE ─────────────────────────────────────────────────────────────
  start() {
    this.running = true;
    requestAnimationFrame(this._frame);
  }

  stop() { this.running = false; }

  resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  _frame() {
    if (!this.running) return;
    this._draw();
    requestAnimationFrame(this._frame);
  }

  // ── ORIENTATION ───────────────────────────────────────────────────────────
  onOrientation(alpha, beta, gamma) {
    this.alpha = alpha * Math.PI / 180;
    this.beta  = beta  * Math.PI / 180;
    this.gamma = gamma * Math.PI / 180;
  }

  lockWallAnchor(dist_m) {
    this.wallDist_m  = dist_m;
    this.wallLocked  = true;
    this.anchorAlpha = this.alpha;
    this.anchorBeta  = this.beta;
    this.anchorGamma = this.gamma;
    return true;
  }

  unlockWall() {
    this.wallLocked = false;
    this.wallDist_m = null;
  }

  // Anchor offset in pixels relative to center
  _anchorOffset() {
    if (!this.wallLocked) return { dx: 0, dy: 0 };
    const W = this.canvas.width, H = this.canvas.height;
    const phoneFOV_H = (this.plateCamera?.fovEquiv_deg ?? 65) * Math.PI / 180;
    const phoneFOV_V = phoneFOV_H * (H / W);
    const fPx_x = (W / 2) / Math.tan(phoneFOV_H / 2);
    const fPx_y = (H / 2) / Math.tan(phoneFOV_V / 2);

    let da = this.alpha - this.anchorAlpha;
    if (da >  Math.PI) da -= 2 * Math.PI;
    if (da < -Math.PI) da += 2 * Math.PI;
    const db = this.beta - this.anchorBeta;

    return { dx: -da * fPx_x, dy: db * fPx_y };
  }

  // ── PROJECTION ────────────────────────────────────────────────────────────
  _project(xW, yW, zW, cx, camY, fPx, dx, dy) {
    const sx = (xW / zW) * fPx + cx + dx;
    const sy = (-yW / zW) * fPx + camY + dy;
    return { x: sx, y: sy };
  }

  // ── DRAW ──────────────────────────────────────────────────────────────────
  _draw() {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);
    if (!this.visible || !this.stageProfile) return;

    const wall     = this.stageProfile.wall;
    const fl       = this.currentFL;
    const camToW   = (this.wallDist_m !== null)
                     ? this.wallDist_m
                     : this.camToChar_m + this.charToWall_m;
    const camToC   = this.camToChar_m;
    const chH      = this.camHeight_m;

    // FOVs
    const stageHFOV = this.stageCamera
      ? hfovRad(this.stageCamera.sensorW_mm, fl) : 0.7;
    const stageVFOV = this.stageCamera
      ? vfovRad(this.stageCamera.sensorH_mm, fl) : 0.5;
    const plateHFOV = this.plateCamera
      ? this.plateCamera.fovEquiv_deg * Math.PI / 180 : 1.29;

    // Safety
    const cr = cropRatio(plateHFOV, stageHFOV);
    const wc = wallCoverage(stageHFOV, camToW, wall.chordM);

    // Phone / plate camera HFOV (matches live preview lens)
    const phoneFOV = (this.plateCamera?.fovEquiv_deg ?? 65) * Math.PI / 180;
    const fPx = (W / 2) / Math.tan(phoneFOV / 2);

    const cx   = W / 2;
    const camY = H * 0.72;   // camera dot position on screen
    const { dx, dy } = this._anchorOffset();

    const Z  = camToW;
    const Zc = camToC;
    const wallBot = -chH;
    const wallTop = wall.heightM - chH;

    const proj = (xW, yW, zW) =>
      this._project(xW, yW, zW, cx, camY, fPx, dx, dy);

    // ── LED WALL ARC ──────────────────────────────────────────────────────
    const R         = wall.radiusM;
    const arcCenterZ = Z + R;
    const halfArc   = (wall.arcDeg / 2) * Math.PI / 180;
    const ARC_SEGS  = 40;

    const arcPt = t => {
      const theta = t * halfArc;
      return { xw: R * Math.sin(theta), zw: arcCenterZ - R * Math.cos(theta) };
    };

    // Bottom arc
    ctx.beginPath();
    for (let i = 0; i <= ARC_SEGS; i++) {
      const t = (i / ARC_SEGS) * 2 - 1;
      const { xw, zw } = arcPt(t);
      const p = proj(xw, wallBot, zw);
      i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = '#FF5C35';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#FF5C35'; ctx.shadowBlur = 8;
    ctx.stroke(); ctx.shadowBlur = 0;

    // Top arc
    ctx.beginPath();
    for (let i = 0; i <= ARC_SEGS; i++) {
      const t = (i / ARC_SEGS) * 2 - 1;
      const { xw, zw } = arcPt(t);
      const p = proj(xw, wallTop, zw);
      i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = 'rgba(255,92,53,0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Vertical sides
    const pBL = proj(-wall.chordM/2, wallBot, Z);
    const pTL = proj(-wall.chordM/2, wallTop, Z);
    const pBR = proj( wall.chordM/2, wallBot, Z);
    const pTR = proj( wall.chordM/2, wallTop, Z);
    ctx.beginPath();
    ctx.moveTo(pBL.x,pBL.y); ctx.lineTo(pTL.x,pTL.y);
    ctx.moveTo(pBR.x,pBR.y); ctx.lineTo(pTR.x,pTR.y);
    ctx.strokeStyle = 'rgba(255,92,53,0.4)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4,4]); ctx.stroke(); ctx.setLineDash([]);

    // Wall label
    const wlp = proj(0, wallTop + 0.25, Z);
    ctx.fillStyle = 'rgba(255,92,53,0.9)';
    ctx.font = '500 11px -apple-system,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`LED WALL · ${wall.arcFt}ft arc · ${wall.chordFt}ft chord`, wlp.x, wlp.y);

    // ── PLATE BOUNDARY (24mm) ─────────────────────────────────────────────
    const plateH = Z * Math.tan(plateHFOV / 2);
    const plateVH = Z * Math.tan((plateHFOV * 0.562) / 2); // approx V from 3:2

    const pp = [
      proj(-plateH,  wallTop, Z), proj( plateH,  wallTop, Z),
      proj( plateH,  wallBot, Z), proj(-plateH,  wallBot, Z),
    ];
    ctx.beginPath();
    ctx.moveTo(pp[0].x,pp[0].y);
    pp.forEach(p => ctx.lineTo(p.x,p.y));
    ctx.closePath();
    ctx.strokeStyle = '#3A9EE8';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#3A9EE8'; ctx.shadowBlur = 8;
    ctx.stroke(); ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(58,158,232,0.04)'; ctx.fill();

    // Rays from camera
    const camPx = { x: cx + dx, y: camY + dy };
    ctx.beginPath();
    ctx.moveTo(camPx.x,camPx.y); ctx.lineTo(pp[0].x,pp[0].y);
    ctx.moveTo(camPx.x,camPx.y); ctx.lineTo(pp[1].x,pp[1].y);
    ctx.strokeStyle = 'rgba(58,158,232,0.3)'; ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = 'rgba(58,158,232,0.85)';
    ctx.font = '500 10px -apple-system,sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${this.plateCamera?.shortName || '24mm'} plate`, pp[0].x + 4, pp[0].y - 4);

    // ── STAGE LENS CROP ───────────────────────────────────────────────────
    const onH  = Z * Math.tan(stageHFOV / 2);
    const onVH = Z * Math.tan(stageVFOV / 2);
    const clampTop = Math.min(wallTop, onVH - chH);
    const clampBot = Math.max(wallBot, -onVH - chH);

    const cp = [
      proj(-onH, clampTop, Z), proj( onH, clampTop, Z),
      proj( onH, clampBot, Z), proj(-onH, clampBot, Z),
    ];
    ctx.beginPath();
    ctx.moveTo(cp[0].x,cp[0].y);
    cp.forEach(p => ctx.lineTo(p.x,p.y));
    ctx.closePath();
    ctx.strokeStyle = '#00E5A0';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#00E5A0'; ctx.shadowBlur = 10;
    ctx.stroke(); ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,229,160,0.05)'; ctx.fill();

    ctx.beginPath();
    ctx.moveTo(camPx.x,camPx.y); ctx.lineTo(cp[0].x,cp[0].y);
    ctx.moveTo(camPx.x,camPx.y); ctx.lineTo(cp[1].x,cp[1].y);
    ctx.strokeStyle = 'rgba(0,229,160,0.28)'; ctx.lineWidth = 1;
    ctx.setLineDash([6,5]); ctx.stroke(); ctx.setLineDash([]);

    ctx.fillStyle = '#00E5A0';
    ctx.font = '600 10px -apple-system,sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${fl}mm crop`, cp[1].x - 4, cp[1].y - 4);

    // ── TALENT ZONE ───────────────────────────────────────────────────────
    const tHalf = Zc * Math.tan(stageHFOV / 2) * 0.45;
    const tGnd  = wallBot + 0.15;
    const tHead = tGnd + 1.75;
    const tL = proj(-tHalf, tGnd, Zc);
    const tR = proj( tHalf, tGnd, Zc);
    const tC = proj(0, tHead * 0.5, Zc);
    const tTop = proj(0, tHead, Zc);

    // Ground line
    ctx.beginPath(); ctx.moveTo(tL.x,tL.y); ctx.lineTo(tR.x,tR.y);
    ctx.strokeStyle = '#A78BFA'; ctx.lineWidth = 2;
    ctx.shadowColor = '#A78BFA'; ctx.shadowBlur = 8;
    ctx.stroke(); ctx.shadowBlur = 0;

    // Figure
    const figH = Math.abs(tTop.y - tL.y);
    const headR = Math.max(8, figH * 0.12);
    ctx.beginPath();
    ctx.arc(tC.x, tTop.y + headR, headR, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(167,139,250,0.18)'; ctx.fill();
    ctx.strokeStyle = '#A78BFA'; ctx.lineWidth = 1.5;
    ctx.shadowColor = '#A78BFA'; ctx.shadowBlur = 6;
    ctx.stroke(); ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.moveTo(tC.x, tTop.y + headR * 2);
    ctx.lineTo(tC.x, tL.y);
    ctx.strokeStyle = 'rgba(167,139,250,0.6)'; ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#A78BFA';
    ctx.font = '600 10px -apple-system,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TALENT', tC.x, tTop.y - 4);

    // ── CAMERA DOT ────────────────────────────────────────────────────────
    ctx.beginPath();
    ctx.arc(camPx.x, camPx.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(148,163,184,0.85)'; ctx.fill();

    // ── DIMENSION ANNOTATIONS ─────────────────────────────────────────────
    const dimX = W - 36;
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1;
    ctx.fillStyle   = 'rgba(255,255,255,0.5)';
    ctx.font = '10px -apple-system,sans-serif';
    ctx.textAlign = 'left';

    const wallPx  = proj(wall.chordM/2, wallBot, Z);
    const charPx  = proj(wall.chordM/2, wallBot, Zc);

    ctx.beginPath();
    ctx.moveTo(dimX, camY); ctx.lineTo(dimX, charPx.y); ctx.stroke();
    ctx.fillText(`${mToFt(camToC).toFixed(0)}ft`, dimX + 3, (camY + charPx.y)/2 + 4);

    ctx.beginPath();
    ctx.moveTo(dimX, charPx.y); ctx.lineTo(dimX, wallPx.y); ctx.stroke();
    ctx.fillText(`${mToFt(this.charToWall_m).toFixed(0)}ft`, dimX + 3, (charPx.y + wallPx.y)/2 + 4);

    // ── SAFETY HUD ────────────────────────────────────────────────────────
    const safety = safetyRating(cr, wc);
    ctx.fillStyle = safety.color + 'CC';
    roundRect(ctx, 14, 14, 88, 30, 8); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.font = 'bold 13px -apple-system,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(safety.label, 58, 34);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
  ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);
  ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);
  ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}
