// MANUAL_THEMES is generated from src/themes/catalog.json by build.js.
// Themes are browser display preferences; manual data/backup formats are untouched.
const MANUAL_THEME_KEY = 'universalManual.theme';
const manualThemeEffects = new Map();
let activeManualThemeEffect = null;
function getManualThemeDefinition(value) {
  return MANUAL_THEMES.find(theme=>theme.id === value || theme.aliases.includes(value)) || MANUAL_THEMES[0];
}
function normalizeManualTheme(value) { return getManualThemeDefinition(value).id; }
function registerManualThemeEffect(id, effect) {
  if (!MANUAL_THEMES.some(theme=>theme.id === id) || manualThemeEffects.has(id)) throw new Error('Invalid or duplicate theme effect: '+id);
  if (typeof effect?.refresh !== 'function' || typeof effect?.dispose !== 'function') throw new Error('Theme effects require refresh and dispose: '+id);
  manualThemeEffects.set(id,effect);
}
function syncManualThemeEffect() {
  const effect = manualThemeEffects.get(normalizeManualTheme(document.documentElement.dataset.theme)) || null;
  if (effect !== activeManualThemeEffect) {
    activeManualThemeEffect?.dispose();
    activeManualThemeEffect = effect;
  }
  effect?.refresh({motionEnabled:manualMotionEnabled(),hidden:document.hidden});
}
function applyManualTheme(value, persist = false) {
  const viewport = persist ? captureAccordionViewport() : null;
  const theme = normalizeManualTheme(value);
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll('#settings-theme input[name="manual-theme"]').forEach(input=>{input.checked = input.value === theme;});
  if (persist) {try {localStorage.setItem(MANUAL_THEME_KEY,theme);} catch {}}
  syncManualMotionState();
  syncLayoutResizerPosition();
  if (viewport) restoreAccordionViewport(viewport);
}
function initThemePreference() {
  let theme = 'modern';
  try {theme = localStorage.getItem(MANUAL_THEME_KEY);} catch {}
  applyManualTheme(theme);
  document.getElementById('settings-theme').addEventListener('change',event=>applyManualTheme(event.target.value,true));
  document.addEventListener('visibilitychange',syncManualThemeEffect);
  document.fonts?.addEventListener('loadingdone',syncManualThemeEffect);
  if (typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(syncManualThemeEffect);
    document.querySelectorAll('.main-layout,.content-area,.app-header').forEach(element=>observer.observe(element));
  } else window.addEventListener('resize',syncManualThemeEffect);
}

// Compatibility helpers for existing accordion decoration anchors.
function createAccordionTitleConveyor(title) {
  const belt = document.createElement('span'); belt.className = 'accordion-title-belt';
  belt.dataset.conveyorLabel = String(title || ''); belt.setAttribute('aria-hidden','true');
  return belt;
}
function updateAccordionTitleConveyor(header,expanded) {
  const belt = header?.querySelector(':scope > .accordion-title-belt');
  if (!expanded) belt?.replaceChildren();
  activeManualThemeEffect?.updateHeader?.(header,expanded);
}
