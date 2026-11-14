// Media Session is optional. Unsupported phone controls must not break playback.
export function setupMediaSession({ audio, actions, session = globalThis.navigator?.mediaSession,
  Metadata = globalThis.MediaMetadata }) {
  const attempt = callback => { try { callback(); } catch { /* Unsupported browser action. */ } };
  const action = (name, callback) => attempt(() => session?.setActionHandler(name, callback));
  const position = () => attempt(() => {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) return session?.setPositionState?.();
    session?.setPositionState?.({ duration: audio.duration, playbackRate: audio.playbackRate,
      position: Math.max(0, Math.min(audio.currentTime, audio.duration)) });
  });
  function seek(seconds) {
    if (!Number.isFinite(seconds) || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    audio.currentTime = Math.max(0, Math.min(seconds, audio.duration));
    position();
  }
  return {
    update({ title, artist, state, previous, next }) {
      if (!session) return;
      attempt(() => {
        if (Metadata) session.metadata = new Metadata({ title, artist, album: 'Akhlaq · Quran',
          artwork: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }] });
        session.playbackState = state;
      });
      action('play', actions.play);
      action('pause', actions.pause);
      action('stop', actions.stop);
      action('previoustrack', previous ? actions.previous : null);
      action('nexttrack', next ? actions.next : null);
      action('seekto', ({ seekTime }) => seek(seekTime));
      action('seekbackward', ({ seekOffset = 10 }) => seek(audio.currentTime - seekOffset));
      action('seekforward', ({ seekOffset = 10 }) => seek(audio.currentTime + seekOffset));
    },
    position,
    resetPosition() { attempt(() => session?.setPositionState?.()); },
    clear() {
      if (!session) return;
      attempt(() => { session.playbackState = 'none'; session.metadata = null; });
      for (const name of ['play', 'pause', 'stop', 'previoustrack', 'nexttrack', 'seekto', 'seekbackward', 'seekforward']) action(name, null);
      attempt(() => session.setPositionState?.());
    },
  };
}
