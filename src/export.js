// ── EXPORT ENGINE ────────────────────────────────────────────────────────────
import { mToFt, cropRatio, wallCoverage, safetyRating,
         hfovRad, vfovRad, LENS_PRESETS } from './profiles.js';

const BRAND_COLOR = '#3A9EE8';
const MONO = "'SF Mono', 'Fira Mono', monospace";
const SANS = "-apple-system, BlinkMacSystemFont, sans-serif";

// ── MAIN ANNOTATED CAPTURE ───────────────────────────────────────────────────
export function renderTechvisSheet({
  videoEl, arCanvas,
  project, session, setup,
  stageProfile, plateCamera, stageCamera,
  currentFL, camToChar_m, charToWall_m,
}) {
  const W = 1080, H = 1920; // portrait A-series ratio
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const ctx = out.getContext('2d');

  const camToWall_m = camToChar_m + charToWall_m;
  const plateHFOV   = plateCamera.fovEquiv_deg * Math.PI / 180;
  const stageHFOV   = hfovRad(stageCamera.sensorW_mm, currentFL);
  const stageVFOV   = vfovRad(stageCamera.sensorH_mm, currentFL);
  const cr          = cropRatio(plateHFOV, stageHFOV);
  const wc          = wallCoverage(stageHFOV, camToWall_m, stageProfile.wall.chordM);
  const safety      = safetyRating(cr, wc);

  // ── 1. VIDEO FRAME (top 55%) ─────────────────────────────────────────────
  const videoH = Math.round(H * 0.52);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, videoH);
  ctx.clip();
  if (videoEl && videoEl.readyState >= 2) {
    const vw = videoEl.videoWidth, vh = videoEl.videoHeight;
    const scale = Math.max(W / vw, videoH / vh);
    const dx = (W - vw * scale) / 2;
    const dy = (videoH - vh * scale) / 2;
    ctx.drawImage(videoEl, dx, dy, vw * scale, vh * scale);
  } else {
    ctx.fillStyle = '#0D1117';
    ctx.fillRect(0, 0, W, videoH);
  }
  ctx.restore();

  // AR overlay on top of video
  if (arCanvas) {
    ctx.drawImage(arCanvas, 0, 0, W, videoH);
  }

  // Safety badge over video
  ctx.fillStyle = safety.color + 'DD';
  roundRect(ctx, W - 130, 20, 110, 38, 10);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.font = `bold 15px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.fillText(safety.label, W - 75, 44);

  // ── 2. INFO PANEL ────────────────────────────────────────────────────────
  const panelY = videoH;
  ctx.fillStyle = '#0A0C0F';
  ctx.fillRect(0, panelY, W, H - panelY);

  // Top accent line
  ctx.fillStyle = BRAND_COLOR;
  ctx.fillRect(0, panelY, W, 3);

  // Project/session/setup header
  let y = panelY + 28;
  ctx.textAlign = 'left';

  label(ctx, 'PROJECT', 24, y); y += 18;
  value(ctx, project?.name || 'UNTITLED', 24, y, 22); y += 28;

  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(24, y, W - 48, 0.5);
  y += 16;

  const col2 = W / 2 + 12;

  label(ctx, 'SESSION', 24, y);
  label(ctx, 'SETUP', col2, y);
  y += 18;
  value(ctx, session?.location || '—', 24, y, 14);
  value(ctx, setup?.setupId || '—', col2, y, 14);
  y += 24;

  label(ctx, 'STAGE', 24, y);
  label(ctx, 'TIMESTAMP', col2, y);
  y += 18;
  value(ctx, stageProfile.shortName || stageProfile.name, 24, y, 14);
  value(ctx, formatDate(new Date()), col2, y, 14);
  y += 28;

  // Divider
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(24, y, W - 48, 0.5);
  y += 20;

  // ── METRICS GRID ────────────────────────────────────────────────────────
  const metrics = [
    { l: 'PLATE CAMERA',   v: plateCamera.shortName },
    { l: 'STAGE CAMERA',   v: stageCamera.shortName },
    { l: 'PLATE LENS',     v: `${plateCamera.nativeFL_mm}mm` },
    { l: 'STAGE LENS',     v: `${currentFL}mm Supreme Prime` },
    { l: 'CAM → WALL',     v: `${camToWall_m.toFixed(1)}m / ${mToFt(camToWall_m).toFixed(1)}ft` },
    { l: 'CAM → TALENT',   v: `${camToChar_m.toFixed(1)}m / ${mToFt(camToChar_m).toFixed(1)}ft` },
    { l: 'TALENT → WALL',  v: `${charToWall_m.toFixed(1)}m / ${mToFt(charToWall_m).toFixed(1)}ft` },
    { l: 'PLATE USED',     v: `${Math.round(cr * 100)}%` },
    { l: 'WALL USED',      v: `${Math.round(wc * 100)}%` },
    { l: 'SAFETY',         v: safety.label, color: safety.color },
  ];

  const colW = (W - 48) / 2;
  metrics.forEach((m, i) => {
    const cx = 24 + (i % 2) * (colW + 0);
    const cy = y + Math.floor(i / 2) * 52;
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    roundRect(ctx, cx, cy, colW - 8, 44, 8);
    ctx.fill();
    label(ctx, m.l, cx + 10, cy + 14);
    value(ctx, m.v, cx + 10, cy + 34, 14, m.color);
  });

  y += Math.ceil(metrics.length / 2) * 52 + 16;

  // ── MULTI-LENS STRIP ────────────────────────────────────────────────────
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(24, y, W - 48, 0.5);
  y += 16;

  label(ctx, 'MULTI-LENS COVERAGE PREVIEW', 24, y); y += 20;

  const lensW = (W - 48 - 16) / LENS_PRESETS.length;
  LENS_PRESETS.forEach((lp, i) => {
    const lx = 24 + i * (lensW + 4);
    const lhfov = hfovRad(stageCamera.sensorW_mm, lp.fl);
    const lcr   = cropRatio(plateHFOV, lhfov);
    const lwc   = wallCoverage(lhfov, camToWall_m, stageProfile.wall.chordM);
    const ls    = safetyRating(lcr, lwc);
    const active = lp.fl === currentFL;

    ctx.fillStyle = active ? BRAND_COLOR + '33' : 'rgba(255,255,255,0.04)';
    roundRect(ctx, lx, y, lensW, 64, 8);
    ctx.fill();
    if (active) {
      ctx.strokeStyle = BRAND_COLOR;
      ctx.lineWidth = 1.5;
      roundRect(ctx, lx, y, lensW, 64, 8);
      ctx.stroke();
    }

    ctx.fillStyle = ls.color;
    ctx.font = `bold 8px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.fillText(ls.label, lx + lensW / 2, y + 12);

    ctx.fillStyle = '#F0EDE8';
    ctx.font = `600 15px ${SANS}`;
    ctx.fillText(lp.label, lx + lensW / 2, y + 32);

    ctx.fillStyle = 'rgba(240,237,232,0.5)';
    ctx.font = `400 10px ${SANS}`;
    ctx.fillText(`${Math.round(lcr * 100)}% plate`, lx + lensW / 2, y + 48);
    ctx.fillText(`${Math.round(lwc * 100)}% wall`, lx + lensW / 2, y + 60);
  });
  y += 80;

  // ── BOTTOM BRANDING ──────────────────────────────────────────────────────
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(24, y, W - 48, 0.5);
  y += 14;

  ctx.fillStyle = BRAND_COLOR;
  ctx.font = `600 11px ${MONO}`;
  ctx.textAlign = 'left';
  ctx.fillText('VP PLATE PLANNER', 24, y);

  ctx.fillStyle = 'rgba(240,237,232,0.3)';
  ctx.font = `400 10px ${MONO}`;
  ctx.textAlign = 'right';
  ctx.fillText(`github.com/SharanRagesh/vp-plate-planner`, W - 24, y);

  return out;
}

// ── HELPERS ──────────────────────────────────────────────────────────────────
function label(ctx, text, x, y) {
  ctx.fillStyle = 'rgba(240,237,232,0.4)';
  ctx.font = `500 9px ${SANS}`;
  ctx.textAlign = 'left';
  ctx.letterSpacing = '0.07em';
  ctx.fillText(text, x, y);
}

function value(ctx, text, x, y, size = 14, color = '#F0EDE8') {
  ctx.fillStyle = color || '#F0EDE8';
  ctx.font = `500 ${size}px ${SANS}`;
  ctx.textAlign = 'left';
  ctx.letterSpacing = '0.01em';
  ctx.fillText(text, x, y);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` +
         ` ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

// ── DOWNLOAD HELPER ───────────────────────────────────────────────────────────
export function downloadCanvas(canvas, filename) {
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href    = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, 'image/jpeg', 0.93);
}
