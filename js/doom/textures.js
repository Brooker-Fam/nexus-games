// ── NEXUS DOOM · TEXTURES ──
// Texture / sprite atlas. Stores `ImageData` keyed by integer id so the
// raycaster can sample texels by column without a per-pixel canvas hit.
//
// Public surface (also attached to `window.DoomTextures`):
//   loadImageTexture(id, url)      → Promise<TextureEntry>
//   addImageElement(id, img)       → TextureEntry
//   addProcedural(id, w, h, fn)    → TextureEntry  // fn(x,y) → [r,g,b,a]
//   get(id)                        → TextureEntry | null
//   has(id)                        → boolean
//
// A TextureEntry is `{ id, width, height, pixels: Uint8ClampedArray }`.
// `pixels` is RGBA, row-major (length = width*height*4). The raycaster
// samples it directly; the gameplay layer never has to know about <canvas>.

(function (global) {
  'use strict';

  const _store = new Map();
  const _scratch = document.createElement('canvas');
  const _scratchCtx = _scratch.getContext('2d', { willReadFrequently: true });

  function _entryFromImage(id, img) {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    _scratch.width = w;
    _scratch.height = h;
    _scratchCtx.clearRect(0, 0, w, h);
    _scratchCtx.drawImage(img, 0, 0);
    const data = _scratchCtx.getImageData(0, 0, w, h).data;
    return { id, width: w, height: h, pixels: data };
  }

  function loadImageTexture(id, url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const e = _entryFromImage(id, img);
        _store.set(id, e);
        resolve(e);
      };
      img.onerror = () => reject(new Error('texture load failed: ' + url));
      img.src = url;
    });
  }

  function addImageElement(id, img) {
    const e = _entryFromImage(id, img);
    _store.set(id, e);
    return e;
  }

  function addProcedural(id, width, height, fn) {
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const c = fn(x, y, width, height) || [0, 0, 0, 255];
        const i = (y * width + x) * 4;
        pixels[i]     = c[0] | 0;
        pixels[i + 1] = c[1] | 0;
        pixels[i + 2] = c[2] | 0;
        pixels[i + 3] = (c[3] == null ? 255 : c[3]) | 0;
      }
    }
    const e = { id, width, height, pixels };
    _store.set(id, e);
    return e;
  }

  function get(id) { return _store.get(id) || null; }
  function has(id) { return _store.has(id); }
  function clear() { _store.clear(); }

  // ── Built-in placeholders ──
  // id 1: brick wall. id 2: tech panel. id 100: stub enemy sprite.
  function installDefaults() {
    if (_store.size > 0) return;

    addProcedural(1, 64, 64, (x, y) => {
      const row = (y / 16) | 0;
      const offset = (row % 2) * 32;
      const bx = (x + offset) % 32;
      const by = y % 16;
      const mortar = bx < 2 || by < 2;
      if (mortar) return [40, 30, 30, 255];
      const n = ((x * 7 + y * 13) % 17) - 8;
      return [150 + n, 60 + (n >> 1), 50 + (n >> 1), 255];
    });

    addProcedural(2, 64, 64, (x, y) => {
      const cx = (x % 16) - 8;
      const cy = (y % 16) - 8;
      const r = Math.sqrt(cx * cx + cy * cy);
      const rim = r > 6 && r < 7.5 ? 220 : 80;
      const plate = ((x >> 4) + (y >> 4)) & 1 ? 40 : 55;
      const v = Math.max(plate, rim - 100);
      return [v >> 1, v, v + 20, 255];
    });

    // Sprite uses alpha=0 for the empty background so the renderer can skip.
    addProcedural(100, 64, 64, (x, y) => {
      const cx = x - 32;
      const cy = y - 32;
      const r = Math.sqrt(cx * cx + cy * cy);
      if (r > 28) return [0, 0, 0, 0];
      if (r > 24) return [120, 0, 40, 255];
      // crude humanoid silhouette
      const inHead = cy < -8 && r < 12;
      const inBody = cy >= -8 && cy < 14 && Math.abs(cx) < 14;
      const inArms = Math.abs(cy) < 4 && Math.abs(cx) < 22;
      if (inHead) return [220, 180, 160, 255];
      if (inBody) return [180, 30, 30, 255];
      if (inArms) return [160, 25, 25, 255];
      return [40, 10, 10, 255];
    });
  }

  global.DoomTextures = {
    loadImageTexture,
    addImageElement,
    addProcedural,
    get,
    has,
    clear,
    installDefaults,
  };
})(window);
