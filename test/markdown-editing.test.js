const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sourcePath = path.join(__dirname, '..', 'src', 'js', '30-markdown-reference.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const domUtilsPath = path.join(__dirname, '..', 'src', 'js', '25-dom-utils.js');
const domUtilsSource = fs.readFileSync(domUtilsPath, 'utf8');

const sandbox = {
  module: { exports: {} },
  exports: {},
  console,
  Node: { ELEMENT_NODE: 1, TEXT_NODE: 3 }
};

vm.createContext(sandbox);
vm.runInContext(source, sandbox);
vm.runInContext(domUtilsSource, sandbox);

const {
  applyMarkdownCommandToText,
  findNextMarkdownToken,
  getExpectedMarkdownPreviewRanges,
  isEditableMarkdownPreviewCurrent,
  markdownToHtml
} = sandbox.module.exports;
const { ensureTrailingEditorCaret, placeCaretAfterInsertedNode } = sandbox;

function createFakeElement(tagName, classNames = []) {
  const classes = new Set(classNames);
  const element = {
    nodeType: 1,
    tagName: tagName.toUpperCase(),
    dataset: {},
    parentNode: null,
    childNodes: [],
    classList: {
      contains: name => classes.has(name)
    }
  };
  Object.defineProperty(element, 'className', {
    get: () => Array.from(classes).join(' '),
    set: value => {
      classes.clear();
      String(value).split(/\s+/).filter(Boolean).forEach(name => classes.add(name));
    }
  });
  return element;
}

function createFakeText(value) {
  return { nodeType: 3, nodeValue: value, parentNode: null };
}

function appendFakeChild(parent, child) {
  child.parentNode = parent;
  parent.childNodes.push(child);
}

test('strong formatting wraps a plain-text selection with visible source markers', () => {
  const result = applyMarkdownCommandToText('앞 강조 뒤', 2, 4, 'strong');
  assert.equal(result.text, '앞 **강조** 뒤');
  assert.equal(result.caretOffset, 8);
});

test('formatting part of an existing token preserves the remaining formatted text', () => {
  const result = applyMarkdownCommandToText('**abcdef**', 4, 6, 'em');
  assert.equal(result.text, '**ab***cd***ef**');
  assert.equal(markdownToHtml(result.text), '<strong>ab</strong><em>cd</em><strong>ef</strong>');
});

test('removing formatting from part of a token preserves both remaining sides', () => {
  const result = applyMarkdownCommandToText('**abcdef**', 4, 6, 'remove');
  assert.equal(result.text, '**ab**cd**ef**');
});

test('format commands do not alter atomic reference selections', () => {
  const result = applyMarkdownCommandToText('앞 {{번호판}} 뒤', 2, 10, 'strong');
  assert.equal(result, null);
});

test('an incomplete emphasis marker remains plain source text', () => {
  assert.equal(findNextMarkdownToken('*미완성', 0), null);
});

test('underscore markers remain plain text', () => {
  assert.equal(findNextMarkdownToken('_기울임_', 0), null);
  assert.equal(markdownToHtml('_기울임_'), '_기울임_');
});

test('asterisk formatting supports adjacent and nested tokens', () => {
  assert.equal(
    markdownToHtml('**강조***기울임***강조**'),
    '<strong>강조</strong><em>기울임</em><strong>강조</strong>'
  );
  assert.equal(markdownToHtml('***동시 적용***'), '<strong><em>동시 적용</em></strong>');
  assert.equal(markdownToHtml('*기울임 **강조** 기울임*'), '<em>기울임 <strong>강조</strong> 기울임</em>');
  assert.equal(markdownToHtml('**강조 *기울임* 강조**'), '<strong>강조 <em>기울임</em> 강조</strong>');
  assert.equal(markdownToHtml('**가격 * 2**'), '<strong>가격 * 2</strong>');
  assert.equal(
    JSON.stringify(getExpectedMarkdownPreviewRanges('**강조***기울임*')),
    JSON.stringify([
      { type: 'strong', start: 2, end: 4 },
      { type: 'em', start: 7, end: 10 }
    ])
  );
});

test('markdown preview mismatch is detected as soon as a marker completes or breaks', () => {
  const rawEditor = createFakeElement('div');
  appendFakeChild(rawEditor, createFakeText('*기울임*'));
  assert.equal(isEditableMarkdownPreviewCurrent(rawEditor, '*기울임*'), false);

  const formattedEditor = createFakeElement('div');
  appendFakeChild(formattedEditor, createFakeText('*'));
  const emphasis = createFakeElement('em', ['editable-md-preview']);
  appendFakeChild(emphasis, createFakeText('기울임'));
  appendFakeChild(formattedEditor, emphasis);
  const closingMarker = createFakeText('*');
  appendFakeChild(formattedEditor, closingMarker);
  assert.equal(isEditableMarkdownPreviewCurrent(formattedEditor, '*기울임*'), true);

  closingMarker.nodeValue = '';
  assert.equal(isEditableMarkdownPreviewCurrent(formattedEditor, '*기울임'), false);
});

test('an atomic node at the editor end receives one non-persistent caret anchor', () => {
  sandbox.document = { createElement: tagName => createFakeElement(tagName) };
  const image = createFakeElement('div', ['embedded-image-wrap']);
  const editor = {
    childNodes: [image],
    lastChild: image,
    querySelector() {
      return this.lastChild?.classList.contains('editor-tail-caret') ? this.lastChild : null;
    },
    appendChild(node) {
      node.parentNode = this;
      this.childNodes.push(node);
      this.lastChild = node;
    }
  };
  image.parentNode = editor;

  ensureTrailingEditorCaret(editor);
  ensureTrailingEditorCaret(editor);

  assert.equal(editor.childNodes.length, 2);
  assert.equal(editor.lastChild.tagName, 'BR');
  assert.equal(editor.lastChild.classList.contains('editor-tail-caret'), true);
  assert.equal(editor.lastChild.dataset.editorOnly, 'true');
});

test('placing the caret after an inserted atomic node creates an end anchor', () => {
  sandbox.document = { createElement: tagName => createFakeElement(tagName) };
  const reference = createFakeElement('span', ['editable-reference-token']);
  const editor = { childNodes: [reference] };
  reference.parentNode = editor;
  Object.defineProperty(reference, 'nextSibling', {
    get: () => editor.childNodes[editor.childNodes.indexOf(reference) + 1] || null
  });
  reference.after = node => {
    node.parentNode = editor;
    editor.childNodes.splice(editor.childNodes.indexOf(reference) + 1, 0, node);
  };
  const range = {
    startNode: null,
    collapsed: false,
    setStartAfter(node) { this.startNode = node; },
    collapse(value) { this.collapsed = value; }
  };

  placeCaretAfterInsertedNode(reference, range);

  assert.equal(editor.childNodes[1].classList.contains('editor-tail-caret'), true);
  assert.equal(range.startNode, reference);
  assert.equal(range.collapsed, true);
});

test('a final plain-text newline gets one visual caret anchor without changing saved text', () => {
  sandbox.document = { createElement: tagName => createFakeElement(tagName) };
  const text = createFakeText('첫줄\n');
  const empty = createFakeText(''); empty.previousSibling = text;
  const editor = {
    childNodes:[text,empty], lastChild:empty,
    querySelector() { return this.lastChild?.classList?.contains('editor-tail-caret') ? this.lastChild : null; },
    appendChild(node) { node.parentNode=this; this.childNodes.push(node); this.lastChild=node; }
  };
  text.parentNode=editor; empty.parentNode=editor;
  ensureTrailingEditorCaret(editor); ensureTrailingEditorCaret(editor);
  assert.equal(editor.childNodes.length,3);
  assert.equal(editor.lastChild.tagName,'BR');
  assert.equal(sandbox.getEditorLogicalText(editor),'첫줄\n');
  const core = fs.readFileSync(path.join(__dirname,'../src/js/60-accordion-core.js'),'utf8');
  const isolated = vm.createContext({Node:sandbox.Node,isEditableReferenceTokenNode:sandbox.isEditableReferenceTokenNode,document:{addEventListener(){}}});
  vm.runInContext(core,isolated);
  assert.equal(isolated.serializeContentWithImages(editor,[]).text,'첫줄\n');
});

test('ordinary text does not receive a synthetic newline or caret node', () => {
  const text=createFakeText('첫줄'); let appended=false;
  ensureTrailingEditorCaret({lastChild:text,querySelector:()=>null,appendChild(){appended=true;}});
  assert.equal(appended,false);
});

test('plain numbered and bullet lists preserve the entered line breaks without block spacing',()=>{
 assert.equal(markdownToHtml('1. 첫 줄\n2. **둘째**\n\n- *셋째*'),'1. 첫 줄<br>2. <strong>둘째</strong><br><br>• <em>셋째</em>');
 assert.equal(markdownToHtml('  1. 들여쓰기\n마지막 줄'),'  1. 들여쓰기<br>마지막 줄');
});
