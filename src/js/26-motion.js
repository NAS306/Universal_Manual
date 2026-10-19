const manualAnimations = new WeakMap();
const MANUAL_MOTION_KEY = 'universalManual.motionPreference';
let manualMotionPreference = 'system';
function normalizeManualMotionPreference(value) { return value === 'reduce' ? 'reduce' : 'system'; }
function getManualMotionLockReason() { return getManualThemeDefinition(document.documentElement.dataset.theme).motionLockReason || ''; }
function isManualMotionLocked() { return Boolean(getManualMotionLockReason()); }
function manualMotionEnabled() {
  return !isManualMotionLocked() && manualMotionPreference !== 'reduce'
    && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
// The theme restriction is temporary; it never overwrites the user's saved preference.
function syncManualMotionState() {
  const locked = isManualMotionLocked();
  const reduced = !manualMotionEnabled();
  document.documentElement.classList.toggle('reduce-motion',reduced);
  const select = document.getElementById('settings-motion');
  if (select) {
    select.value = locked ? 'reduce' : manualMotionPreference;
    select.disabled = locked;
    const field = select.closest('.settings-field');
    if (field) {
      field.classList.toggle('motion-locked',locked);
      if (locked) field.title = getManualMotionLockReason();
      else field.removeAttribute('title');
    }
  }
  if (reduced) {
    // Settle existing JS animations as well as disabling future CSS/JS motion.
    document.getAnimations().forEach(animation=>{try {animation.finish();} catch {animation.cancel();}});
  }
  if (typeof syncManualThemeEffect === 'function') syncManualThemeEffect();
}
function applyManualMotionPreference(value, persist = false) {
  manualMotionPreference = normalizeManualMotionPreference(value);
  syncManualMotionState();
  if (persist) { try {localStorage.setItem(MANUAL_MOTION_KEY,manualMotionPreference);} catch {} }
}
function animateManualElement(element, frames, options = {}) {
  if (!element) return null;
  manualAnimations.get(element)?.cancel();
  if (!manualMotionEnabled() || typeof element.animate !== 'function') return null;
  const animation = element.animate(frames,{duration:220,easing:'cubic-bezier(.2,.7,.2,1)',...options});
  manualAnimations.set(element,animation);
  const cleanup = () => { if (manualAnimations.get(element) === animation) manualAnimations.delete(element); };
  animation.finished.then(cleanup,cleanup);
  return animation;
}
function animateManualLayout(change) {
  const elements = [...document.querySelectorAll('.main-layout > .sidebar, .main-layout > .content-area')];
  const before = elements.map(el => el.getBoundingClientRect());
  change();
  elements.forEach((el,i) => {
    if (getComputedStyle(el).visibility === 'hidden') return;
    const after = el.getBoundingClientRect(), previous = before[i];
    if (!after.width || !previous.width) return;
    const x = previous.left-after.left, y = previous.top-after.top;
    const scale = previous.width/after.width;
    if (Math.abs(x)+Math.abs(y)+Math.abs(scale-1)<.01) return;
    animateManualElement(el,[{transformOrigin:'top left',transform:'translate('+x+'px,'+y+'px) scaleX('+scale+')'},{transformOrigin:'top left',transform:'none'}]);
  });
}
// 완료 후 고정 높이를 남기지 않고 내용에 따른 일반 레이아웃으로 돌아갑니다.
function animateAccordionExpansion(element, expanded, previousHeight) {
  manualAnimations.get(element)?.cancel();
  if (!manualMotionEnabled()) return;
  const height = expanded ? element.getBoundingClientRect().height : previousHeight;
  if (!height) return;
  animateManualElement(element, expanded
    ? [{height:'0px',opacity:0,paddingTop:'0px',paddingBottom:'0px',overflow:'hidden'},{height:height+'px',opacity:1,paddingTop:'10px',paddingBottom:'10px',overflow:'hidden'}]
    : [{display:'flex',height:height+'px',opacity:1,overflow:'hidden'},{display:'flex',height:'0px',opacity:0,paddingTop:'0px',paddingBottom:'0px',overflow:'hidden'}]);
}
