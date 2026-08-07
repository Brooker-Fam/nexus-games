// Main game loop, driven by requestAnimationFrame.
//
// Keep this module dumb: it computes dt and forwards it to the supplied
// tick callback. Production, hatching, and UI updates all live elsewhere so
// the follow-up hoglets can add their own per-frame work via the same hook.

export function startLoop(state, onTick) {
  let rafId = 0;
  let running = true;

  function frame(now) {
    if (!running) return;
    // First frame after load/resume: clamp dt to 0 so we don't dump a huge
    // delta into egg production. v1 explicitly does NOT do offline catch-up.
    let dt = now - state.lastTickAt;
    if (!Number.isFinite(dt) || dt < 0) dt = 0;
    // Clamp aggressive deltas (tab was backgrounded). 1s is plenty for a
    // foreground frame; anything beyond that we treat as a pause.
    if (dt > 1000) dt = 1000;

    state.lastTickAt = now;
    onTick(state, dt, now);
    rafId = requestAnimationFrame(frame);
  }

  // Initialise lastTickAt against the rAF clock to avoid a one-time spike
  // (Date.now() and performance.now() are on different epochs).
  rafId = requestAnimationFrame((now) => {
    state.lastTickAt = now;
    rafId = requestAnimationFrame(frame);
  });

  return {
    stop() {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
    },
  };
}
