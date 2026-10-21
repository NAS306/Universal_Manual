// Measure all active belts together, then write. Open/resize requests coalesce.
let pixelConveyorFrame = null;
function getThemeConveyorRepeatCount(viewportWidth,unitWidth) {
  return unitWidth>0 ? Math.max(2,Math.ceil(Math.max(0,viewportWidth)/unitWidth)+1) : 2;
}
function queuePixelConveyorRefresh() {
  if (pixelConveyorFrame !== null) return;
  pixelConveyorFrame = requestAnimationFrame(()=>{
    pixelConveyorFrame = null;
    refreshThemeConveyors();
  });
}
function refreshThemeConveyors() {
  const belts = [...document.querySelectorAll('.theme-ticker, .accordion-header.active > .accordion-title-belt')];
  // Prepare missing tracks before reading any dimensions.
  const prepared = belts.map(belt=>{
    const label = belt.dataset.conveyorLabel || '';
    let track = belt.firstElementChild;
    if (!track || track.dataset.label !== label) {
      track = document.createElement('span'); track.className = 'theme-belt-track'; track.dataset.label = label;
      const group = document.createElement('span'); group.className = 'theme-belt-group';
      const unit = document.createElement('span'); unit.className = 'theme-belt-unit'; unit.textContent = label+' // ';
      group.append(unit); track.append(group); belt.replaceChildren(track);
    }
    return {belt,track,group:track.firstElementChild};
  });
  const measured = prepared.map(entry=>({...entry,width:entry.belt.clientWidth,unitWidth:entry.group.firstElementChild.getBoundingClientRect().width}));
  measured.forEach(({belt,track,group,width,unitWidth})=>{
    if (!width || !unitWidth) return;
    const count = getThemeConveyorRepeatCount(width,unitWidth), unit = group.firstElementChild;
    if (track.dataset.repeatCount !== String(count)) {
      group.replaceChildren(...Array.from({length:count},()=>unit.cloneNode(true)));
      while (track.children.length>1) track.lastElementChild.remove();
      track.append(group.cloneNode(true)); track.dataset.repeatCount = String(count);
    }
    const speed = belt.classList.contains('accordion-title-belt') ? 24 : 20;
    const duration = Math.max(6,unitWidth*count/speed)+'s';
    if (track.style.getPropertyValue('--belt-duration') !== duration) track.style.setProperty('--belt-duration',duration);
  });
}
function updatePixelAccordionTitleConveyor(header,expanded) {
  if (!expanded) header?.querySelector(':scope > .accordion-title-belt')?.replaceChildren();
  queuePixelConveyorRefresh();
}
function clearPixelConveyors() {
  if (pixelConveyorFrame !== null) cancelAnimationFrame(pixelConveyorFrame);
  pixelConveyorFrame = null;
  document.querySelectorAll('[data-conveyor-label]').forEach(belt=>belt.replaceChildren());
}
registerManualThemeEffect('pixel', {
  refresh: () => queuePixelConveyorRefresh(),
  dispose: clearPixelConveyors,
  updateHeader: updatePixelAccordionTitleConveyor
});
