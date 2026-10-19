// Shared editor/rendering utilities.
// Keep small cross-module helpers here instead of making feature modules depend
// on each other for incidental DOM behavior.
function trimTrailingRenderedBreaks(html) {
  return String(html || '').replace(/(?:\s|<br\s*\/?>)+$/gi, '');
}

function removeEmptyInsertionGapAfter(node) {
  let next = node?.nextSibling;
  while (next) {
    if (next.nodeType === Node.TEXT_NODE && /^[\s\u00a0]*$/.test(next.nodeValue || '')) {
      const current = next;
      next = next.nextSibling;
      current.remove();
      continue;
    }

    if (next.nodeType === Node.ELEMENT_NODE && next.tagName === 'BR') {
      const current = next;
      next = next.nextSibling;
      current.remove();
      continue;
    }

    break;
  }
}

function isAtomicEditorNode(node) {
  return node?.nodeType === Node.ELEMENT_NODE
    && (node.classList.contains('embedded-image-wrap')
      || node.classList.contains('editable-reference-token'));
}

function ensureTrailingEditorCaret(editor) {
  if (!editor || editor.querySelector(':scope > .editor-tail-caret:last-child')) return;
  // A trailing newline needs a visible final line for Chromium to keep an IME range.
  // Ignore empty text siblings left by Range.insertNode without changing the selection.
  let last = editor.lastChild;
  while (last?.nodeType === Node.TEXT_NODE && !last.nodeValue) last = last.previousSibling;
  const endsWithNewline = last?.nodeType === Node.TEXT_NODE && last.nodeValue.endsWith('\n');
  if (!isAtomicEditorNode(last) && !endsWithNewline) return;
  const anchor = document.createElement('br');
  anchor.className = 'editor-tail-caret';
  anchor.dataset.editorOnly = 'true';
  editor.appendChild(anchor);
}

function placeCaretAfterInsertedNode(node, range) {
  if (!node?.parentNode || !range) return;
  removeEmptyInsertionGapAfter(node);
  if (!node.nextSibling) {
    const anchor = document.createElement('br');
    anchor.className = 'editor-tail-caret';
    anchor.dataset.editorOnly = 'true';
    node.after(anchor);
  }
  range.setStartAfter(node);
  range.collapse(true);
}
