// Link only contiguous display text. Source text and image metadata are unchanged.
function trimReadableUrl(candidate) {
  const opening = {')':'(',']':'[','}':'{'};
  const counts = {'(':0,')':0,'[':0,']':0,'{':0,'}':0};
  for (const character of candidate) if (Object.hasOwn(counts,character)) counts[character]++;
  let end = candidate.length;
  while (end > 0) {
    const last = candidate[end-1];
    if (/[.,!?;:\u3002\uff0c\uff01\uff1f\uff1b\uff1a\u3001]/u.test(last)) { end--; continue; }
    if (Object.hasOwn(opening,last) && counts[last] > counts[opening[last]]) {
      counts[last]--; end--; continue;
    }
    break;
  }
  return candidate.slice(0,end);
}
function getReadableUrlMatches(text) {
  const source = String(text || '');
  const matches = [];
  const pattern = /https?:\/\/[^\s<>"'`\u0000-\u001f\u007f\u2018-\u201d\u300c-\u300f\u00ab\u00bb]+/gi;
  for (const match of source.matchAll(pattern)) {
    const label = trimReadableUrl(match[0]);
    try {
      const url = new URL(label);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
      matches.push({start:match.index,end:match.index+label.length,text:label,href:url.href});
    } catch {}
  }
  return matches;
}
function linkReadableUrls(container) {
  if (currentMode !== 'read' || !container) return;
  const skip = 'a,button,script,style,input,textarea,select,[contenteditable="true"],.editable-reference-token,.embedded-image-wrap,.embedded-image-fallback';
  const walker = document.createTreeWalker(container,NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentElement && !node.parentElement.closest(skip)) nodes.push(node);
  }
  nodes.forEach(node=>{
    const matches = getReadableUrlMatches(node.nodeValue);
    if (!matches.length) return;
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    matches.forEach(match=>{
      fragment.append(document.createTextNode(node.nodeValue.slice(cursor,match.start)));
      const link = document.createElement('a');
      link.className = 'manual-url';
      link.href = match.href;
      link.textContent = match.text;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.addEventListener('click',event=>event.stopPropagation());
      fragment.append(link);
      cursor = match.end;
    });
    fragment.append(document.createTextNode(node.nodeValue.slice(cursor)));
    node.replaceWith(fragment);
  });
}
