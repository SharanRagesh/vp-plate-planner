// Optional WebXR LiDAR / plane hit-test wall anchor (iOS Safari 17+, Android ARCore)
import * as THREE from '../vendor/three/build/three.module.js';

export async function isXrWallPickAvailable() {
  if (!navigator.xr) return false;
  try {
    return await navigator.xr.isSessionSupported('immersive-ar');
  } catch {
    return false;
  }
}

/**
 * Opens a short immersive-ar session; user taps a vertical surface to lock wall facing.
 * Resolves with anchor quaternion (Three.js) or null on cancel / unsupported.
 */
export function pickWallWithXr() {
  return new Promise((resolve) => {
    if (!navigator.xr) {
      resolve(null);
      return;
    }

    let session;
    let refSpace;
    let hitSource;
    let viewerSpace;
    const cleanup = () => {
      if (session) session.end().catch(() => {});
      session = null;
    };

    const onSelect = (e) => {
      const frame = e.frame;
      if (!hitSource || !frame) return;
      const hits = frame.getHitTestResults(hitSource);
      if (!hits.length) return;
      const pose = hits[0].getPose(refSpace);
      if (!pose) return;

      const q = new THREE.Quaternion(
        pose.transform.orientation.x,
        pose.transform.orientation.y,
        pose.transform.orientation.z,
        pose.transform.orientation.w,
      );
      cleanup();
      resolve(q);
    };

    navigator.xr.isSessionSupported('immersive-ar').then(async (ok) => {
      if (!ok) {
        resolve(null);
        return;
      }
      try {
        session = await navigator.xr.requestSession('immersive-ar', {
          requiredFeatures: ['hit-test'],
          optionalFeatures: ['local-floor', 'dom-overlay'],
          domOverlay: { root: document.body },
        });
        refSpace = await session.requestReferenceSpace('local');
        viewerSpace = await session.requestReferenceSpace('viewer');
        hitSource = await session.requestHitTestSource({ space: viewerSpace });
        session.addEventListener('select', onSelect);
        session.addEventListener('end', () => resolve(null));

        const onFrame = (t, frame) => {
          session.requestAnimationFrame(onFrame);
        };
        session.requestAnimationFrame(onFrame);

        setTimeout(() => {
          if (session) {
            cleanup();
            resolve(null);
          }
        }, 45000);
      } catch (err) {
        console.warn('XR wall pick unavailable', err);
        resolve(null);
      }
    });
  });
}
