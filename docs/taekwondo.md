# Neon Dojo

The Taekwondo tab is a single-player camera game, gated behind the Nexus PRO subscription (see `js/shared/memberships.js` and `docs` for the membership tiers — BASIC, PRO, MAX). A signed-in player without an active PRO (or MAX) membership sees a locked overlay with an upgrade prompt instead of the dojo controls. A round lasts 60 active seconds. Kick a virtual pad with either foot, then lower the foot before kicking again. Consecutive hits increase the score multiplier. Easy uses larger pads and longer target windows; Normal uses smaller pads at varying heights below the calibrated hips.

## Playing locally

Run `python3 -m http.server 8765 --bind 127.0.0.1` from the repository, then open `http://localhost:8765/#taekwondo`. The static preview has no membership API to call, so `window.nexusProActive` stays `false` and the dojo renders locked. Account and payment APIs, including PRO entitlement, require the existing Vercel development environment.

Choose **Enable camera**, allow access, and stand upright with shoulders, knees, and feet visible. Hold still for two seconds to calibrate. The game then counts down from three. Use **Recalibrate** after moving the camera. Recalibration starts a new round.

**Try demo** works without camera permissions or model downloads. Click or tap the pads, or press A/Left Arrow and D/Right Arrow to hit pads on the corresponding side. Escape pauses. Demo and camera best scores are stored separately on this device, with separate scores for each pace.

Use a recent browser with Web Workers, WebAssembly, and OffscreenCanvas. Camera access needs HTTPS or localhost. Clear enough space to move, keep kicks controlled, and stop if tracking feels unreliable. The game detects target contact; it does not assess technique or measure impact force.

## Implementation

- `game.js` connects the existing game registry, camera lifecycle, calibration, input, and round UI.
- `model.js` contains pose validation, swept foot-to-pad collision, and scoring. Coordinates match the mirrored video, with distances corrected for its aspect ratio.
- `tracker.js` owns permission requests, video playback, cancellable startup, and frame scheduling.
- `pose-worker.js` loads MediaPipe Tasks Vision 0.10.32 and the Pose Landmarker Lite float16 model version 1. It processes one frame at a time, capped at 24 requests per second, with a GPU delegate and CPU fallback.
- `renderer.js` uses Canvas 2D for a mirrored, aspect-fit camera image, landmarks, targets, and effects. It preserves the full camera frame rather than cropping feet.
- `view.js` and `css/taekwondo.css` provide the responsive controls and stage.

Model and runtime files download from jsDelivr and Google Storage only after camera activation. Video frames and body coordinates stay in memory on the device. The stage, video, and canvas are excluded from PostHog capture with `ph-no-capture`. Normal site analytics remain separate from camera processing.

Low-confidence or missing body points freeze the round timer. Samples older than 350 ms cannot score. A foot must be visible, moving, lifted, and crossing a target from outside it; holding a foot over a pad cannot repeatedly score. These thresholds need evaluation with physical cameras and varied players.

Stop, tab changes, leaving or hiding the page, errors, and completed rounds release the camera and worker. Pause freezes gameplay while keeping the visible camera preview active. Switching away abandons the round.

## Validation

`npm test` covers calibration, fast kicks crossing between samples, low-confidence/stale samples, foot rearming, score progression, expiry, target placement, and delayed worker callbacks. Browser checks exercised demo input, pause, camera rejection, synthetic camera calibration and kicks, tracking loss, and camera cleanup. The worker was also run with MediaPipe's sample person image and returned 33 landmarks.

Physical-camera kick accuracy has not been validated. It depends on lighting, framing, camera speed, and device performance.
