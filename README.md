# VP Plate Planner

AR-assisted on-location plate shoot planning for virtual production teams.

**Live app → [SharanRagesh.github.io/vp-plate-planner](https://SharanRagesh.github.io/vp-plate-planner)**

---

## What it does

Answers the key question on location: *"Will this environment work on our stage?"*

- Places a virtual LED wall in AR space anchored to the real environment via gyroscope
- Shows your 24mm plate capture boundary and on-set lens crop overlaid on the camera feed
- Calculates cam→wall, cam→talent, talent→wall distances in real time
- Flags SAFE / TIGHT / RISKY / INVALID based on plate coverage vs stage lens
- Organises work into Projects → Sessions → Setup IDs (matching real VP shoot workflow)
- Exports annotated techvis sheets with metadata burn-in for shoot bibles

## Stage baked in

| Parameter | Value |
|---|---|
| Stage | ANR VP Stage — Chennai |
| Wall | 52ft arc · 48ft chord · 21ft tall |
| Wall radius | ~10.5m · ~86.5° arc |
| Resolution | 6912 × 2808px · AOTO RM 2.3 |

## Camera profiles

| Camera | Role | Sensor |
|---|---|---|
| iPhone 17 Pro Max | Plate | ~24mm equiv |
| Sony A7R IV | Plate | Full frame · 24mm |
| Sony A7S III | Plate | Full frame · 24mm |
| RED Komodo 6K | Plate | Super35 |
| URSA Cine 12K LF | Stage (on-set) | LF · 36.35mm |

## Install on iPhone / iPad

1. Open **[SharanRagesh.github.io/vp-plate-planner](https://SharanRagesh.github.io/vp-plate-planner)** in **Safari**
2. Tap the Share button → **Add to Home Screen**
3. Open from home screen — it runs full screen, offline-capable

## On-location workflow

1. Open app → select or create a Project
2. Create a Plate Session (location name, plate camera, stage profile)
3. Tap **▶ AR** to open the AR viewer
4. Tap **Set Wall** → point phone at the wall centre → tap to lock gyro anchor
5. Tap **Manual** → enter measured distances (tape or laser)
6. Switch on-set lenses with the 24 / 35 / 50 / 85 / 135 buttons
7. Read SAFE / TIGHT / RISKY indicator
8. Tap **Save Setup** to record framing into the session
9. Tap **⬤ Capture** to export an annotated techvis JPG

## Tech stack

- Vanilla JS ES modules — no build step, no framework
- ARKit-compatible via WebXR (Safari) + DeviceOrientation API
- PWA — installs to home screen, works offline after first load
- All data stored locally on device (localStorage)
- GitHub Pages hosting — free, HTTPS, permanent URL

## Setup IDs

Each saved framing gets a structured ID:

```
SETUP_001_MASTER
SETUP_002_COUNTER_A
SETUP_003_COUNTER_B
SETUP_004_TIGHT
```

Exported techvis sheets include: Project · Session · Setup ID · Stage · Timestamp · Lens · Distances · Safety rating

---

Built for Qube Cinema VP team · ANR Stage · Chennai
