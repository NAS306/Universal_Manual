// 설정 UI를 관리 메뉴와 분리합니다. 각 기능이 설정값과 저장을 담당합니다.
function openAppSettings() {
  const dialog = document.getElementById('app-settings');
  setButtonMenuOpen(false);
  if (!dialog.open) {
    dialog.showModal();
    animateManualElement(dialog,[{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'none'}],{duration:160});
  }
  document.querySelector('#settings-theme input:checked')?.focus({preventScroll:true});
}
function initAppSettings() {
  initThemePreference();
  initReadingPreferences();
  initDictionaryModePreference();
  const dialog = document.getElementById('app-settings');
  document.getElementById('settings-open').addEventListener('click',openAppSettings);
  document.getElementById('settings-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom) dialog.close();
  });
  dialog.addEventListener('keydown',event=>{
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')].filter(element=>element.getClientRects().length && (element.type !== 'radio' || element.checked));
    const first = controls[0], last = controls[controls.length-1];
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  dialog.addEventListener('close',()=>document.getElementById('menu-toggle').focus({preventScroll:true}));
}
