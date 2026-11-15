// Presentation preferences are local and never affect prayer or audio settings.
export function setupInterface({ stored, save }) {
  const selector = document.getElementById('app-theme');
  const preference = stored('akhlaq.appearance.v1').theme;
  selector.value = ['dark', 'light', 'system'].includes(preference) ? preference : 'dark';
  const system = window.matchMedia('(prefers-color-scheme: light)');
  function apply() {
    const light = selector.value === 'light' || (selector.value === 'system' && system.matches);
    document.documentElement.dataset.theme = light ? 'light' : 'dark';
    document.querySelector('meta[name="theme-color"]').content = light ? '#f6f3eb' : '#101c19';
  }
  selector.addEventListener('change', () => {
    apply();
    document.getElementById('theme-status').textContent = save('akhlaq.appearance.v1', { theme: selector.value })
      ? 'Appearance saved.' : 'Applied for now; your device could not save this preference.';
  });
  system.addEventListener('change', apply);
  apply();
  // Give an on-screen keyboard room without pausing audio or losing its controls.
  let restingHeight = window.innerHeight, restingWidth = window.innerWidth;
  const editable = () => document.activeElement?.matches('textarea, input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=file])');
  function keyboardLayout() {
    const height = window.visualViewport?.height || window.innerHeight;
    if (Math.abs(window.innerWidth - restingWidth) > 100) { restingHeight = window.innerHeight; restingWidth = window.innerWidth; }
    const open = editable() && restingHeight - height > 140;
    document.body.classList.toggle('keyboard-open', open);
    if (!editable() || height > restingHeight) restingHeight = window.innerHeight;
  }
  document.addEventListener('focusin', keyboardLayout);
  document.addEventListener('focusout', () => setTimeout(keyboardLayout, 0));
  window.addEventListener('resize', keyboardLayout);
  window.visualViewport?.addEventListener('resize', keyboardLayout);
}
