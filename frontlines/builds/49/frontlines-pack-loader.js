/* Transport-only pack splitting. The reconstructed Godot pack is byte-identical. */
(function () {
  'use strict';
  window.frontlinesStartGame = async function (engine, config, options) {
    const progress = options.onProgress || function () {};
    const response = await fetch('index.pack.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error('Game download manifest is unavailable. Please reload.');
    const manifest = await response.json();
    if (manifest.format !== 1 || !Number.isSafeInteger(manifest.bytes) || manifest.bytes < 1 || manifest.bytes > 512 * 1024 * 1024 || !Array.isArray(manifest.chunks) || manifest.chunks.length > 32) {
      throw new Error('Invalid game download manifest.');
    }
    const pack = new Uint8Array(manifest.bytes);
    let offset = 0;
    progress(0, manifest.bytes);
    // The engine loads alongside the pack. Attach the rejection handler now so
    // a failed engine download cannot become an unhandled promise rejection.
    let engineError = null;
    const initialized = engine.init(config.executable).catch(function (error) { engineError = error; });
    for (const chunk of manifest.chunks) {
      if (!/^index\.pck\.part-\d{2}$/.test(chunk.file) || !Number.isSafeInteger(chunk.bytes) || chunk.bytes < 1 || offset + chunk.bytes > pack.length || !/^[a-f0-9]{64}$/.test(chunk.sha256)) {
        throw new Error('Invalid game download part.');
      }
      const downloaded = await fetch(chunk.file);
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
    await initialized;
    if (engineError) throw engineError;
    await engine.preloadFile(pack, 'index.pck');
    return engine.start(Object.assign({}, options, { args: ['--main-pack', 'index.pck'].concat(config.args || []) }));
  };
}());
