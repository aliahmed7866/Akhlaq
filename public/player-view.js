export function audioClock(seconds) {
  const value = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return Math.floor(value / 60) + ':' + String(value % 60).padStart(2, '0');
}

// Presentation changes never replace, pause or reload the playback element.
export function setupPlayerView({ stored, save, state, seek }) {
  const get = id => document.getElementById(id);
  const player = get('quran-player'), toggle = get('player-expand');
  const slider = get('player-seek'), time = get('player-time');
  let compact = stored('akhlaq.player.view').compact !== false;
  let editing = false, editTrack = '';
  function layout() {
    player.dataset.compact = String(compact);
    toggle.textContent = compact ? 'Expand' : 'Minimise';
    toggle.setAttribute('aria-expanded', String(!compact));
    toggle.setAttribute('aria-label', compact ? 'Expand audio player' : 'Minimise audio player');
  }
  toggle.addEventListener('click', () => {
    compact = !compact; editing = false; layout(); update();
    if (!save('akhlaq.player.view', {compact})) get('player-view-status').textContent = 'Player layout changed for this session; your device could not save it.';
  });
  const valid = s => s.track && Number.isFinite(s.duration) && s.duration > 0 && !s.finished && !s.error;
  function update() {
    const s = state(), available = valid(s);
    slider.disabled = !available;
    if (editing) return;
    const duration = available ? s.duration : 0;
    const seconds = Math.min(duration, Math.max(0, s.seconds || 0));
    slider.max = String(duration || 1); slider.value = String(seconds);
    slider.setAttribute('aria-valuetext', audioClock(seconds) + ' of ' + audioClock(duration));
    time.textContent = duration ? audioClock(seconds) + ' / ' + audioClock(duration) : 'Position available when audio loads';
  }
  function begin() { if (!editing) { editing = true; editTrack = state().track; } }
  slider.addEventListener('pointerdown', begin);
  slider.addEventListener('keydown', e => { if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(e.key)) begin(); });
  slider.addEventListener('input', () => {
    begin(); time.textContent = audioClock(Number(slider.value)) + ' / ' + audioClock(Number(slider.max));
    slider.setAttribute('aria-valuetext', audioClock(Number(slider.value)) + ' of ' + audioClock(Number(slider.max)));
  });
  slider.addEventListener('change', () => {
    const s = state(), seconds = Number(slider.value);
    if (valid(s) && (!editing || s.track === editTrack) && Number.isFinite(seconds)) seek(Math.max(0, Math.min(seconds, Math.max(0, s.duration - .1))), s.track);
    else if (editing && s.track !== editTrack) get('player-view-status').textContent = 'The audio moved to the next part. Adjust its position again.';
    editing = false; update();
  });
  for (const event of ['pointercancel','blur']) slider.addEventListener(event, () => { editing = false; update(); });
  layout(); update();
  return {update};
}
