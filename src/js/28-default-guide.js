// Update only recognized, unmodified guides bundled in earlier versions.
// User-authored descriptions, tables, images and child items are never replaced.
const LEGACY_GUIDE_TITLES = new Set(['◉ 메뉴얼 설명','◉ 매뉴얼 사용 안내']);
const LEGACY_GUIDE_CONTENT_SIGNATURES = new Set(["1656:539c8542","1832:3087dd24","373:1501f77a","422:a21a68fb","162:66dd9500"]);
const LEGACY_GUIDE_PAYLOAD_SIGNATURES = new Set(["4611:4bbcdafc","10714:12d05b9b","10890:67c651b5","7504:f4b2a5fe","9762:bd685f67","4596:d4de8a2b","4687:641d75e1","4782:88194bf4"]);
function stableGuideValue(value) {
  if (Array.isArray(value)) return value.map(stableGuideValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stableGuideValue(value[key])]));
  return value;
}
// Length + FNV-1a recognizes shipped documentation; this is not a security hash.
function guideFingerprint(value) {
  const source = JSON.stringify(stableGuideValue(value));
  let hash = 2166136261;
  for (let index=0;index<source.length;index++) hash = Math.imul(hash ^ source.charCodeAt(index),16777619);
  return source.length+':'+(hash>>>0).toString(16);
}
function guidePayload(item) {
  return {title:item.title,content:item.content,tables:item.tables||[],images:item.images||[],children:item.children||[]};
}
function ensureDefaultDescriptionGuide() {
  for (const item of manualData.menu || []) {
    if (!LEGACY_GUIDE_TITLES.has(item.title)) continue;
    if (!LEGACY_GUIDE_CONTENT_SIGNATURES.has(guideFingerprint(item.content || ''))) continue;
    if (!LEGACY_GUIDE_PAYLOAD_SIGNATURES.has(guideFingerprint(guidePayload(item)))) continue;
    const current = DEFAULT_DATA.menu.find(section=>section.isDescriptionSection);
    if (current) {
      Object.assign(item,cloneDefaultDataValue(current));
      installDefaultGuideExamples();
    }
  }
}

// Examples are installed only while upgrading an untouched bundled guide.
// Preserve custom entries, including a user-owned name that collides with an example.
const PREVIOUS_EXAMPLE_PAYLOADS = new Set(["873:3f97f212","741:6229df98","110:baf5fbbf","279:fced8e8","1328:e22e2f5d","492:5b709766","526:75dada08"]);
function installDefaultGuideExamples() {
  for (const flag of ['isReferenceSection','isDictionarySection']) {
    const template = DEFAULT_DATA.menu.find(item => item[flag]);
    if (!template) continue;
    let root = manualData.menu.find(item => item[flag] || (flag === 'isReferenceSection' && item.title === template.title));
    if (!root) {
      manualData.menu.push(cloneDefaultDataValue(template));
      continue;
    }
    if (PREVIOUS_EXAMPLE_PAYLOADS.has(guideFingerprint(guidePayload(root)))) {
      Object.assign(root,cloneDefaultDataValue(template));
      continue;
    }
    if (!Array.isArray(root.children)) root.children = [];
    // References resolve from the first root; dictionary terms resolve across all roots.
    const sourceRoots = flag === 'isReferenceSection' ? [root] : manualData.menu.filter(section => section[flag]);
    for (const entry of template.children || []) {
      const existing = sourceRoots.flatMap(section => section.children || []).find(child => (flag === 'isDictionarySection' ? String(child.title || '').split('&').some(keyword => keyword.trim() === entry.title) : String(child.title || '').trim() === entry.title));
      if (!existing) root.children.push(cloneDefaultDataValue(entry));
      else if (PREVIOUS_EXAMPLE_PAYLOADS.has(guideFingerprint(guidePayload(existing)))) Object.assign(existing,cloneDefaultDataValue(entry));
    }
  }
}
