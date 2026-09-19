const FRAME_INTERVAL = 1000 / 24;
const CAMERA_TIMEOUT = 60000;
const MODEL_TIMEOUT = 60000;
const FRAME_TIMEOUT = 8000;

function abortError() {
  return new DOMException('Camera session cancelled.', 'AbortError');
}

// Builds a camera fault carrying a short analytics `reason`. Set `expected` for
// device or environment conditions the player can fix (blocked camera, slow
// frame). Expected faults are shown on screen but never reported as exceptions.
function cameraFault(message, reason, expected) {
  const error = new Error(message);
  error.reason = reason;
  if (expected) error.expected = true;
  return error;
}

function waitFor(promise, signal, timeout, message, reason, expected = false) {
  return new Promise((resolve, reject) => {
    const finish = (callback, value) => {
      clearTimeout(timer);
      signal.removeEventListener('abort', cancel);
      callback(value);
    };
    const cancel = () => finish(reject, signal.reason || abortError());
    const timer = setTimeout(() => finish(reject, cameraFault(message, reason, expected)), timeout);
    signal.addEventListener('abort', cancel, { once: true });
    promise.then(value => finish(resolve, value), error => finish(reject, error));
    if (signal.aborted) cancel();
  });
}

function waitForVideo(video, signal) {
  if (video.readyState >= 2 && video.videoWidth) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener('loadeddata', ready);
      video.removeEventListener('error', failed);
      signal.removeEventListener('abort', cancelled);
    };
    const ready = () => {
      cleanup();
      resolve();
    };
    const failed = () => {
      cleanup();
      reject(cameraFault('The camera video could not start. Try another camera.', 'video_failed', true));
    };
    const cancelled = () => {
      cleanup();
      reject(signal.reason || abortError());
    };
    video.addEventListener('loadeddata', ready, { once: true });
    video.addEventListener('error', failed, { once: true });
    signal.addEventListener('abort', cancelled, { once: true });
    if (signal.aborted) cancelled();
  });
}

export function createPoseTracker({ video, onPose, onStatus = () => {}, onError = () => {} }) {
  let current = null;

  function cleanUp(session, reason = abortError()) {
    session.controller.abort(reason);
    cancelAnimationFrame(session.animationFrame);
    clearTimeout(session.frameTimer);
    if (session.onVisibility) document.removeEventListener('visibilitychange', session.onVisibility);
    session.worker?.terminate();
    for (const track of session.stream?.getTracks() || []) {
      track.removeEventListener('ended', session.onEnded);
      track.stop();
    }
    if (session.stream && video.srcObject === session.stream) {
      video.pause();
      video.srcObject = null;
    }
  }

  function fail(session, error) {
    if (current !== session) return;
    current = null;
    cleanUp(session, error);
    if (session.started) onError(error);
  }

  function nextFrame(session, now) {
    if (current !== session) return;
    session.animationFrame = requestAnimationFrame(time => nextFrame(session, time));
    if (session.inFlight || video.readyState < 2 ||
        video.currentTime === session.lastVideoTime || now - session.lastCapture < FRAME_INTERVAL) return;

    session.inFlight = true;
    session.lastCapture = performance.now();
    session.lastVideoTime = video.currentTime;
    session.frameId += 1;
    // A slow frame is not a crash. Drop the stalled frame so the next animation
    // frame captures a fresh one; a late pose for the abandoned frameId is
    // ignored below. The session stays alive and the round timer freezes on its
    // own while no pose arrives.
    session.frameTimer = setTimeout(() => {
      if (current === session) session.inFlight = false;
    }, FRAME_TIMEOUT);

    createImageBitmap(video).then(bitmap => {
      if (current !== session) {
        bitmap.close();
        return;
      }
      try {
        session.worker.postMessage({
          type: 'frame',
          bitmap,
          timestamp: session.lastCapture,
          frameId: session.frameId,
        }, [bitmap]);
      } catch (error) {
        bitmap.close();
        fail(session, error);
      }
    }).catch(error => fail(session, error));
  }

  async function initialize(session) {
    const { signal } = session.controller;
    try {
      if (!globalThis.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw cameraFault('Camera access needs HTTPS or localhost in a supported browser.', 'insecure_context', true);
      }
      if (!globalThis.Worker || !globalThis.createImageBitmap || !globalThis.OffscreenCanvas) {
        throw cameraFault('Body tracking needs a recent browser. Try the latest Chrome, Edge, or Safari.', 'unsupported_browser', true);
      }
      onStatus('requesting');
      const camera = navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          width: { ideal: 960 },
          height: { ideal: 540 },
          frameRate: { ideal: 30, max: 30 },
        },
      }).then(stream => {
        if (current !== session) {
          stream.getTracks().forEach(track => track.stop());
          throw signal.reason || abortError();
        }
        session.stream = stream;
        return stream;
      });
      await waitFor(camera, signal, CAMERA_TIMEOUT, 'Camera permission timed out. Allow access and try again.', 'permission_timeout', true);
      if (current !== session) throw signal.reason || abortError();

      session.onEnded = () => fail(session, cameraFault('The camera disconnected. Reconnect it and try again.', 'camera_disconnected', true));
      session.stream.getVideoTracks().forEach(track => track.addEventListener('ended', session.onEnded));
      video.muted = true;
      video.playsInline = true;
      video.srcObject = session.stream;
      onStatus('loading');
      await waitFor(video.play(), signal, 15000, 'The camera video could not start. Try restarting it.', 'video_failed', true);
      await waitFor(waitForVideo(video, signal), signal, 15000, 'The camera did not provide video. Try another camera.', 'video_failed', true);
      if (current !== session) throw signal.reason || abortError();

      session.worker = new Worker(new URL('./pose-worker.js', import.meta.url));
      const ready = new Promise(resolve => {
        session.worker.onmessage = ({ data }) => {
          if (current !== session) return;
          if (data.type === 'ready') resolve();
          if (data.type === 'error') fail(session, cameraFault(data.message, 'worker_error'));
          if (data.type === 'pose' && data.frameId === session.frameId && session.inFlight) {
            clearTimeout(session.frameTimer);
            session.inFlight = false;
            onPose(data.landmarks, data.timestamp);
          }
        };
      });
      session.worker.onerror = event => {
        event.preventDefault();
        fail(session, cameraFault('Body tracking could not run. Check your connection and try again.', 'worker_failed'));
      };
      session.worker.onmessageerror = () => fail(session, cameraFault('Body tracking could not read a camera frame.', 'frame_read_failed'));
      session.worker.postMessage({ type: 'initialize' });
      await waitFor(ready, signal, MODEL_TIMEOUT, 'Body tracking took too long to load. Check your connection and try again.', 'model_timeout');
      if (current !== session) throw signal.reason || abortError();
      session.started = true;
      // Pause the frame watchdog while the tab is hidden: browsers throttle the
      // capture loop then, so drop any in-flight frame instead of letting its
      // timer count down against a stall the player cannot see.
      session.onVisibility = () => {
        if (current !== session || !document.hidden) return;
        clearTimeout(session.frameTimer);
        session.inFlight = false;
      };
      document.addEventListener('visibilitychange', session.onVisibility);
      onStatus('tracking');
      session.animationFrame = requestAnimationFrame(time => nextFrame(session, time));
    } catch (error) {
      if (current === session) {
        current = null;
        cleanUp(session, error);
      }
      throw error;
    }
  }

  function start() {
    if (current) return current.startPromise;
    const session = {
      controller: new AbortController(),
      stream: null,
      worker: null,
      onVisibility: null,
      started: false,
      animationFrame: 0,
      frameTimer: 0,
      inFlight: false,
      frameId: 0,
      lastCapture: -Infinity,
      lastVideoTime: -1,
    };
    current = session;
    session.startPromise = initialize(session);
    return session.startPromise;
  }

  function stop() {
    const session = current;
    current = null;
    if (session) cleanUp(session);
  }

  return { start, stop };
}

//# sourceMappingURL=tracker.js.map
