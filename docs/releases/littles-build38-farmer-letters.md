# Littles build 38 — Farmer letter audio and easier tracing

Alphabet, name tracing and balloon letters now play 79 recorded ElevenLabs cues using the established Hope/Jade, Noah/Rhys and Mike/Jay voices. Letter targets determine the displayed Farmer and matching recording. Letter Z uses “zed”. Names remain on the device; unsupported letter characters receive recorded tracing guidance. The game no longer uses device speech synthesis for these activities.

Wrong balloon selections play the same Farmer's gentle correction followed by the target recording. Success waits for the recorded praise to finish. Completion uses a sound effect alongside a single Farmer voice, avoiding overlapping spoken win recordings. Replay, closing a game, mute and backgrounding cancel active narration through the shared audio engine.

Rainbow tracing is over twice its previous width. Completion measures the union of the brush's coverage over sampled letter pixels, including the whole segment between finger events. Repeated strokes on the same spot do not increase coverage. Coverage is rebuilt from stored strokes after resizing. Saved name keepsakes use thicker strokes too.

Validation: all 79 MP3s fully decoded with ffmpeg; the Littles regression suite and syntax checks passed. Browser play completed eight balloon rounds with all three Farmers represented, verified wrong-letter correction and target playback, traced A to its success screen, and completed a sample name to its keepsake with Jay's recorded completion cue. No browser console errors were recorded during these interactions. The new audio and versioned runtime files are included in the build 38 offline cache.

Generation provenance is in `assets/audio/letters-generation.json`. `tools/import-littles-letter-audio.cjs` checks the expected pause boundaries before splitting the three source batches, slows delivery without changing pitch and normalizes clip volume. Source batches are retained locally under `.artifacts/littles-audio`.
