# Littles local play

Four complete two-player games: Harvest Four, Three in the Meadow, rock–paper–scissors (first to three), and Harvest Memory Match. Each has shared-device mode, direct device mode, full-screen farm artwork, accessible labelled controls, scores, rematch/exit, and Farmer Jay narration.

## Local network, not an online room

The implementation uses an encrypted WebRTC data channel with `iceServers: []`. No STUN, TURN, internet signalling, Supabase rooms or public player directory are used. Only local host candidates are retained. The existing separate cloud save service is unrelated to the game connection; local matches do not require an account.

Browser pages cannot discover every device on a household Wi-Fi just by matching a colour. Pairing therefore requires a grown-up to exchange an offer QR and a reply QR once. Matching colour and shape confirms the intended room; colour alone is not an access credential. Codes expire after ten minutes and are never uploaded or put into a public room list. Copy/paste is available when scanning is unavailable. Camera access is only requested when Scan is chosen, uses no microphone, and tracks stop on completion, leaving, or closing the scanner.

1. Open/cache Littles on both devices before going offline.
2. Choose a two-player game. One device hosts and one joins.
3. Choose the same colour and shape on both.
4. Joining device reads host QR, then host reads the joining device’s reply QR.
5. Keep both screens open and play. Rematches keep the connection.

Router client isolation, guest Wi-Fi, VPNs, browser privacy policies and device sleep may block or interrupt direct routes. There is no silent internet relay fallback. Shared-device play remains available without pairing.

## Trust and validation

The host validates legal turns/actions and broadcasts bounded, validated snapshots. Arbitrary peer HTML is never rendered; game and produce IDs are allowlisted. Hidden memory cards and unsubmitted RPS choices are omitted from peer snapshots. This is friendly family play, not an anti-cheat or paid-reward system: the hosting device is trusted. No text chat, names, public discovery, purchases or paid leaderboard rewards are part of this protocol.

## Dependencies and maintenance

Bundled QR libraries are pinned in `tools/littles-local/package-lock.json`; rebuild with `npm ci` then `node build.cjs` in that folder. Their licenses ship in the game’s `vendor` folder. No runtime CDN is needed for QR generation/reading.

References: [WebRTC peer connections](https://webrtc.org/getting-started/peer-connections), [MDN ICE candidates](https://developer.mozilla.org/en-US/docs/Web/API/RTCIceCandidate).
