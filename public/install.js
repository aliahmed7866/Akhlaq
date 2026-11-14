export function setupInstall() {
  const button = document.getElementById('install');
  const note = document.getElementById('install-note');
  const standalone = window.matchMedia('(display-mode: standalone)');
  let prompt;
  let installed = false;
  const update = () => { button.hidden = installed || standalone.matches || navigator.standalone === true; };
  update();
  standalone.addEventListener('change', update);
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    prompt = event;
  });
  window.addEventListener('appinstalled', () => {
    prompt = null;
    installed = true;
    update();
    note.hidden = true;
  });
  button.addEventListener('click', async () => {
    if (prompt) {
      const event = prompt;
      prompt = null;
      try {
        const { outcome } = await event.prompt();
        if (outcome === 'accepted') {
          installed = true;
          update();
          note.hidden = true;
        }
        return;
      } catch {
        // The browser's own install menu is still available.
      }
    }
    note.hidden = !note.hidden;
  });

  if (!navigator.serviceWorker) return;
  // Let an existing session finish in the current release. The next launch will load the new shell.
  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {
    document.getElementById('offline-status').textContent = 'Keep Termux running to open Akhlaq in this browser.';
  });
  navigator.serviceWorker.ready.then(() => {
    document.getElementById('offline-status').textContent = 'Ready for offline use';
  });
}
