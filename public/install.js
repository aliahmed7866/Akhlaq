export function setupInstall(hasUnsavedReflection, isPlaying = () => false) {
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
  const workers = navigator.serviceWorker;
  const offlineStatus = document.getElementById('offline-status');
  const notice = document.getElementById('update-notice');
  const status = document.getElementById('update-status');
  const apply = document.getElementById('apply-update');
  let updateRequested = false;
  workers.addEventListener('controllerchange', () => {
    if (updateRequested) location.reload();
    else notice.hidden = true;
  });

  workers.register('/sw.js', { updateViaCache: 'none' }).then(registration => {
    const showWaiting = () => {
      notice.hidden = !registration.waiting || !workers.controller;
    };
    showWaiting();
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', showWaiting);
    });
    apply.addEventListener('click', () => {
      if (!registration.waiting) return showWaiting();
      if (isPlaying()) {
        status.textContent = 'Pause the recitation before updating. Your listening place will be saved.';
        return;
      }
      if (hasUnsavedReflection()) {
        status.textContent = 'Save your draft reflection in Practice, then tap Update & reload.';
        return;
      }
      updateRequested = true;
      apply.disabled = true;
      status.textContent = 'Applying update…';
      registration.waiting.postMessage('activate-update');
    });
    let lastCheck = Date.now();
    window.addEventListener('focus', () => {
      const now = Date.now();
      if (now - lastCheck < 30_000) return;
      lastCheck = now;
      void registration.update().catch(() => {});
    });
  }).catch(() => {
    offlineStatus.textContent = 'Keep Termux running to open Akhlaq in this browser.';
  });
  workers.ready.then(() => { offlineStatus.textContent = 'Ready for offline use'; });
}
