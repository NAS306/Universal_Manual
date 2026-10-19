const fs = require('node:fs');
const path = require('node:path');

// A small build-time contract, not a runtime plugin loader.
function validateThemeCatalog(entries, srcDir) {
  if (!Array.isArray(entries) || !entries.length || entries[0]?.id !== 'modern') throw new Error('Theme catalog must start with modern.');
  const ids = new Set();
  const fields = new Set(['id','label','aliases','styles','script','motionLockReason']);
  const token = /^[A-Za-z][A-Za-z0-9_-]*$/;
  function claim(value) {
    if (typeof value !== 'string' || !token.test(value) || ids.has(value)) throw new Error('Invalid or duplicate theme ID/alias: '+value);
    ids.add(value);
  }
  function resource(file, extension) {
    if (typeof file !== 'string' || !file || path.isAbsolute(file) || file.includes('\\') || path.extname(file) !== extension) throw new Error('Invalid theme resource: '+file);
    const resolved = path.resolve(srcDir,file), relative = path.relative(srcDir,resolved);
    if (relative.startsWith('..'+path.sep) || relative === '..' || path.isAbsolute(relative)) throw new Error('Theme resource must stay inside src: '+file);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) throw new Error('Missing theme resource: '+file);
  }
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || Object.keys(entry).some(key=>!fields.has(key))) throw new Error('Unknown theme catalog field.');
    claim(entry.id);
    if (typeof entry.label !== 'string' || !entry.label.trim()) throw new Error('Theme label is required: '+entry.id);
    if (entry.aliases !== undefined && !Array.isArray(entry.aliases)) throw new Error('Theme aliases must be an array: '+entry.id);
    (entry.aliases || []).forEach(claim);
    if (!Array.isArray(entry.styles)) throw new Error('Theme styles must be an array: '+entry.id);
    entry.styles.forEach(file=>resource(file,'.css'));
    if (entry.script !== undefined) resource(entry.script,'.js');
    if (entry.motionLockReason !== undefined && (typeof entry.motionLockReason !== 'string' || !entry.motionLockReason.trim())) throw new Error('Invalid motion lock reason: '+entry.id);
  }
  return entries;
}
function loadThemeCatalog(srcDir) {
  return validateThemeCatalog(JSON.parse(fs.readFileSync(path.join(srcDir,'themes/catalog.json'),'utf8')),srcDir);
}
module.exports = {loadThemeCatalog,validateThemeCatalog};
