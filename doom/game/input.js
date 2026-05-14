// Input handling. Tracks held keys + mouse delta for the current frame.
//
// Pointer-lock is requested on the bound canvas so the mouse can drive look
// without leaving the page. ESC releases it (browser-managed).

export function createInput(canvas) {
  const keys = Object.create(null);
  const justPressed = Object.create(null);
  let mouseDX = 0;
  let firing = false;
  let pointerLocked = false;

  function onKeyDown(e) {
    if (e.repeat) return;
    const k = e.code;
    keys[k] = true;
    justPressed[k] = true;
    // Stop browser defaults for game keys so arrows don't scroll the page.
    if (GAME_KEYS.has(k)) e.preventDefault();
  }
  function onKeyUp(e) {
    keys[e.code] = false;
    if (GAME_KEYS.has(e.code)) e.preventDefault();
  }
  function onMouseMove(e) {
    if (pointerLocked) mouseDX += e.movementX || 0;
  }
  function onMouseDown(e) {
    if (e.button === 0) {
      if (!pointerLocked && canvas.requestPointerLock) canvas.requestPointerLock();
      firing = true;
    }
  }
  function onMouseUp(e) {
    if (e.button === 0) firing = false;
  }
  function onPointerLockChange() {
    pointerLocked = document.pointerLockElement === canvas;
  }
  function onContextMenu(e) { e.preventDefault(); }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('contextmenu', onContextMenu);
  document.addEventListener('pointerlockchange', onPointerLockChange);

  function isDown(code) { return !!keys[code]; }
  function wasPressed(code) { return !!justPressed[code]; }

  function endFrame() {
    for (const k in justPressed) justPressed[k] = false;
    mouseDX = 0;
  }

  function getAxes() {
    let forward = 0, strafe = 0, turn = 0;
    if (isDown('KeyW') || isDown('ArrowUp'))    forward += 1;
    if (isDown('KeyS') || isDown('ArrowDown'))  forward -= 1;
    if (isDown('KeyA')) strafe -= 1;
    if (isDown('KeyD')) strafe += 1;
    if (isDown('ArrowLeft'))  turn -= 1;
    if (isDown('ArrowRight')) turn += 1;
    return { forward, strafe, turn };
  }

  function destroy() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mouseup', onMouseUp);
    canvas.removeEventListener('contextmenu', onContextMenu);
    document.removeEventListener('pointerlockchange', onPointerLockChange);
  }

  return {
    getAxes,
    isDown,
    wasPressed,
    get mouseDX() { return mouseDX; },
    get firing() { return firing; },
    get pointerLocked() { return pointerLocked; },
    endFrame,
    destroy,
  };
}

const GAME_KEYS = new Set([
  'KeyW','KeyA','KeyS','KeyD',
  'ArrowUp','ArrowDown','ArrowLeft','ArrowRight',
  'Space','ShiftLeft','ShiftRight',
  'Digit1','Digit2','Digit3','Digit4','Digit5',
  'KeyP','KeyR','Tab',
]);
