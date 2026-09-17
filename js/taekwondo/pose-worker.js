const VISION_ROOT = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

let landmarker;

async function initialize() {
  const { FilesetResolver, PoseLandmarker } = await import(`${VISION_ROOT}/vision_bundle.mjs`);
  const vision = await FilesetResolver.forVisionTasks(`${VISION_ROOT}/wasm`);
  const options = {
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.55,
    minPosePresenceConfidence: 0.55,
    minTrackingConfidence: 0.5,
    outputSegmentationMasks: false,
  };
  try {
    landmarker = await PoseLandmarker.createFromOptions(vision, {
      ...options,
      canvas: new OffscreenCanvas(1, 1),
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
    });
  } catch {
    landmarker = await PoseLandmarker.createFromOptions(vision, {
      ...options,
      canvas: new OffscreenCanvas(1, 1),
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
    });
  }
  self.postMessage({ type: 'ready' });
}

self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'initialize') await initialize();
    if (data.type === 'frame') {
      try {
        const result = landmarker.detectForVideo(data.bitmap, data.timestamp);
        self.postMessage({
          type: 'pose',
          frameId: data.frameId,
          timestamp: data.timestamp,
          landmarks: result.landmarks[0] || [],
        });
      } finally {
        data.bitmap.close();
      }
    }
  } catch (error) {
    self.postMessage({ type: 'error', message: error?.message || 'Body tracking could not start.' });
  }
};

//# sourceMappingURL=pose-worker.js.map
