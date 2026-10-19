// 두 그룹의 너비를 같게 만들어 반복 경계에서도 끊기거나 빈 공간이 생기지 않습니다.
function getThemeConveyorRepeatCount(viewportWidth,unitWidth) {
  return unitWidth>0 ? Math.max(2,Math.ceil(Math.max(0,viewportWidth)/unitWidth)+1) : 2;
}
function refreshThemeConveyor(belt) {
  const width = belt.clientWidth;
  if (!width) return;
  const label = belt.dataset.conveyorLabel || '';
  let track = belt.firstElementChild;
  if (!track || track.dataset.label !== label) {
    track = document.createElement('span'); track.className = 'theme-belt-track'; track.dataset.label = label;
    const group = document.createElement('span'); group.className = 'theme-belt-group';
    const unit = document.createElement('span'); unit.className = 'theme-belt-unit'; unit.textContent = label+' // ';
    group.append(unit); track.append(group); belt.replaceChildren(track);
  }
  const firstGroup = track.firstElementChild;
  const unit = firstGroup.firstElementChild;
  const unitWidth = unit.getBoundingClientRect().width;
  if (!unitWidth) return;
  const count = getThemeConveyorRepeatCount(width,unitWidth);
  if (track.dataset.repeatCount !== String(count)) {
    firstGroup.replaceChildren(...Array.from({length:count},()=>unit.cloneNode(true)));
    while (track.children.length>1) track.lastElementChild.remove();
    track.append(firstGroup.cloneNode(true)); track.dataset.repeatCount = String(count);
  }
  const speed = belt.classList.contains('accordion-title-belt') ? 24 : 20;
  const duration = Math.max(6,firstGroup.getBoundingClientRect().width/speed)+'s';
  if (track.style.getPropertyValue('--belt-duration') !== duration) track.style.setProperty('--belt-duration',duration);
}
function updatePixelAccordionTitleConveyor(header,expanded) {
  const belt = header?.querySelector(':scope > .accordion-title-belt');
  if (!belt) return;
  if (!expanded) belt.replaceChildren();
  else refreshThemeConveyor(belt);
}
function clearPixelConveyors() {
  document.querySelectorAll('[data-conveyor-label]').forEach(belt=>belt.replaceChildren());
}
function refreshThemeConveyors() {
  document.querySelectorAll('.theme-ticker, .accordion-header.active > .accordion-title-belt').forEach(refreshThemeConveyor);
}
registerManualThemeEffect('pixel', {
  refresh: refreshThemeConveyors,
  dispose: clearPixelConveyors,
  updateHeader: updatePixelAccordionTitleConveyor
});
