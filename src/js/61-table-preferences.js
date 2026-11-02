// UI preference only; never add layout measurements to manual data or backups.
const MANUAL_TABLE_WIDTH_KEY = 'universalManual.preserveTableWidth';
const MANUAL_TABLE_BASE_WIDTH = 720;
const MANUAL_TABLE_COLUMN_WIDTH = 180;
function getManualTableMinWidth(table) {
  const numeric = Number(table?.cols);
  const columns = Number.isFinite(numeric) ? Math.max(1,Math.floor(numeric)) : 1;
  return Math.max(MANUAL_TABLE_BASE_WIDTH,columns * MANUAL_TABLE_COLUMN_WIDTH);
}
function applyManualTableWidthPreference(enabled, persist = false) {
  const viewport = persist ? captureAccordionViewport() : null;
  const preserve = enabled !== false;
  document.documentElement.dataset.preserveTableWidth = String(preserve);
  document.getElementById('settings-preserve-table-width').checked = preserve;
  if (persist) {
    try { localStorage.setItem(MANUAL_TABLE_WIDTH_KEY,String(preserve)); } catch {}
  }
  if (viewport) restoreAccordionViewport(viewport);
}
function initManualTableWidthPreference() {
  let enabled = true;
  try { enabled = localStorage.getItem(MANUAL_TABLE_WIDTH_KEY) !== 'false'; } catch {}
  applyManualTableWidthPreference(enabled);
  document.getElementById('settings-preserve-table-width').addEventListener('change',event=>{
    applyManualTableWidthPreference(event.target.checked,true);
  });
}
