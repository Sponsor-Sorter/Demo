/* Verified pack delivery: exclusive buffer ownership and lazy HD wardrobe. */
(function () {
  'use strict';
  async function downloadPack(manifestPath, progress) {
    const response = await fetch(manifestPath, { cache: 'no-cache' });
    if (!response.ok) throw new Error('Game download manifest is unavailable. Please reload.');
    const manifest = await response.json();
    if (manifest.format !== 1 || !Number.isSafeInteger(manifest.bytes) || manifest.bytes < 1 || manifest.bytes > 512 * 1024 * 1024 || !Array.isArray(manifest.chunks) || manifest.chunks.length < 1 || manifest.chunks.length > 32) {
      throw new Error('Invalid game download manifest.');
    }
    let pack = new Uint8Array(manifest.bytes);
    let offset = 0;
    progress(0, manifest.bytes);
    for (const chunk of manifest.chunks) {
      if (!new RegExp('^' + (manifestPath === 'index.pack.json' ? 'index' : 'wardrobe') + '\\.pck\\.part-\\d{2}$').test(chunk.file) || !Number.isSafeInteger(chunk.bytes) || chunk.bytes < 1 || offset + chunk.bytes > pack.length || !/^[a-f0-9]{64}$/.test(chunk.sha256)) {
        throw new Error('Invalid game download part.');
      }
      const downloaded = await fetch(new URL(chunk.file, new URL(manifestPath, location.href)));
      if (!downloaded.ok || !downloaded.body) throw new Error('A game download part failed. Please reload to retry.');
      const reader = downloaded.body.getReader();
      let used = 0;
      try {
        for (;;) {
          const item = await reader.read();
          if (item.done) break;
          if (used + item.value.length > chunk.bytes) throw new Error('Game download part is larger than expected.');
          pack.set(item.value, offset + used);
          used += item.value.length;
          progress(offset + used, manifest.bytes);
        }
      } catch (error) {
        await reader.cancel().catch(function () {});
        throw error;
      } finally {
        reader.releaseLock();
      }
      if (used !== chunk.bytes) throw new Error('Game download was interrupted. Please reload.');
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', pack.subarray(offset, offset + used)));
      const actual = Array.from(digest, function (byte) { return byte.toString(16).padStart(2, '0'); }).join('');
      if (actual !== chunk.sha256) throw new Error('Game download verification failed. Please reload.');
      offset += used;
    }
    if (offset !== pack.length) throw new Error('Game download is incomplete.');
    return pack.buffer;
  }
  window.frontlinesStartGame = async function (engine, config, options) {
    const progress = options.onProgress || function () {};
    let engineError = null;
    const initialized = engine.init('../66/index').catch(function (error) { engineError = error; });
    let buffer = await downloadPack('index.pack.json', progress);
    await initialized;
    if (engineError) throw engineError;
    // Transfer this verified, exclusively owned buffer to MEMFS before starting
    // Godot. preloadFile + callMain retained several full copies during startup.
    if (Engine.FRONTLINES_PACK_OWNERSHIP !== 1) throw new Error('Game loader version mismatch. Please reload.');
    engine.copyToFS('index.pck', buffer, true);
    buffer = null;
    window.FrontlinesBrowserContent = {
      state: 'idle', progress: 0, error: '',
      request: function () {
        const self = this;
        if (self.state === 'ready' || self.state === 'loading') return;
        self.state = 'loading'; self.error = ''; self.progress = 0;
        (async function () {
          let content = await downloadPack('../66/wardrobe.pack.json', function (used, total) { self.progress = used / total; });
          engine.copyToFS('/frontlines-wardrobe.pck', content, true);
          content = null;
          self.state = 'ready';
        }()).catch(function (error) {
          self.error = String(error.message || error); self.state = 'failed';
        });
      }
    };
    // End the download stack before the engine begins decoding its resources.
    await new Promise(function (resolve) { setTimeout(resolve, 0); });
    return engine.start(Object.assign({}, options, { args: ['--main-pack', 'index.pck'].concat(config.args || []) }));
  };
}());
