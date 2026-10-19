const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname, '../src/js', name), 'utf8');

function setup() {
  const entries = new Map();
  const timers = new Map();
  const elements = new Map();
  let nextTimer = 0;
  const document = {
    getElementById(id) { return elements.get(id) || null; },
    querySelectorAll() { return []; },
    addEventListener() {},
    createElement() { return { setAttribute() {}, textContent: '', hidden: false }; },
    body: { appendChild(el) { elements.set(el.id, el); } }
  };
  elements.set('manual-name', { textContent: 'A' });
  const sandbox = {
    console, document, window: { location: { hash: '' } }, history: { replaceState() {} },
    DEFAULT_MANUAL_NAME: '무제', DEFAULT_STORAGE_KEY: 'manualData(무제)', LEGACY_DEFAULT_MANUAL_NAME: '기본',
    activeStorageKey: 'manualData(A)', currentMode: 'edit',
    manualData: { manualName: 'A', menu: [{ title: '업무', content: '초기', children: [] }] },
    localStorage: {
      get length() { return entries.size; }, key: i => [...entries.keys()][i],
      getItem: k => entries.get(k) ?? null, setItem: (k,v) => entries.set(k,String(v)), removeItem: k => entries.delete(k)
    },
    setTimeout(fn) { const id = ++nextTimer; timers.set(id, fn); return id; },
    clearTimeout: id => timers.delete(id),
    alert() {}, prompt: () => 'C',
    captureAccordionViewport() { return null; }, restoreAccordionViewport() {},
    renderAll() {}, normalizeAllTables() {}, ensureSystemSections() {}, reopenPath() {},
    normalizeImageList: v => v || []
  };
  vm.createContext(sandbox);
  vm.runInContext(read('20-storage.js') + '\n' + read('90-editing.js'), sandbox);
  sandbox.ensureGlobalTabs = () => {};
  sandbox.refreshStorageKeyMenu = () => {};
  entries.set('manualData(A)', JSON.stringify(sandbox.manualData));
  sandbox.resetEditHistory();
  return { s: sandbox, entries, elements, timers, flush() { for (const [id, fn] of [...timers]) { timers.delete(id); fn(); } } };
}

test('undo immediately after typing restores the last saved editing state', () => {
  const { s } = setup();
  s.manualData.menu[0].content = '입력 직후';
  s.saveToLocalStorage();
  s.undoLastEdit();
  assert.equal(s.manualData.menu[0].content, '초기');
});

test('same-name blur does not cancel a pending content save', () => {
  const { s, entries, flush } = setup();
  s.manualData.menu[0].content = '최근 입력';
  s.saveToLocalStorage();
  s.renameActiveStorageKeyForManualName();
  flush();
  assert.equal(JSON.parse(entries.get('manualData(A)')).menu[0].content, '최근 입력');
});

test('duplicate manual name keeps saving to the current manual without overwriting the other manual', () => {
  const { s, entries } = setup();
  const other = JSON.stringify({ manualName: 'B', menu: [] });
  entries.set('manualData(B)', other);
  s.manualData.manualName = 'B';
  s.manualData.menu[0].content = '보존할 내용';
  s.saveToLocalStorage(true);
  assert.equal(JSON.parse(entries.get('manualData(A)')).menu[0].content, '보존할 내용');
  assert.equal(s.manualData.manualName, 'A');
  assert.equal(entries.get('manualData(B)'), other);
});

test('quota failure is reported and a later retry can save without losing memory data', () => {
  const { s, entries, elements } = setup();
  const write = s.localStorage.setItem;
  s.localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
  s.manualData.menu[0].content = '메모리 유지';
  assert.equal(s.saveToLocalStorage(true), false);
  assert.equal(JSON.parse(entries.get('manualData(A)')).menu[0].content, '초기');
  assert.equal(s.manualData.menu[0].content, '메모리 유지');
  assert.equal(elements.get('manual-save-status').hidden, false);
  s.localStorage.setItem = write;
  assert.equal(s.saveToLocalStorage(true), true);
  assert.equal(JSON.parse(entries.get('manualData(A)')).menu[0].content, '메모리 유지');
});

test('copy flushes pending edits to the original before changing the active manual', () => {
  const { s, entries } = setup();
  s.manualData.menu[0].content = '복사 직전 입력';
  s.saveToLocalStorage();
  s.createStorageKey();
  assert.equal(JSON.parse(entries.get('manualData(A)')).menu[0].content, '복사 직전 입력');
  assert.equal(JSON.parse(entries.get('manualData(C)')).menu[0].content, '복사 직전 입력');
});

test('failed copy keeps the original active and does not claim success', () => {
  const { s } = setup();
  const write = s.localStorage.setItem;
  s.localStorage.setItem = (k,v) => { if(k === 'manualData(C)') throw Error('QuotaExceededError'); write(k,v); };
  s.createStorageKey();
  assert.equal(s.activeStorageKey, 'manualData(A)');
  assert.equal(s.manualData.manualName, 'A');
});

test('nested malformed backup data is rejected before importing', () => {
  const { s } = setup();
  assert.equal(s.isManualDataShape({ menu: [null] }), false);
  assert.equal(s.isManualDataShape({ menu: [{ title: 'x', children: [42] }] }), false);
  assert.equal(s.isManualDataShape({ menu: [{ content: 123 }] }), false);
  assert.equal(s.isManualDataShape({ menu: [{ tables: [{ cells: [[null]] }] }] }), false);
  assert.equal(s.isManualDataShape({ menu: [{ title: '구형 백업', tables: [], children: [] }] }), true);
});

test('structural edit refreshes the search paths after rendering', () => {
  let refreshed = 0;
  const s = vm.createContext({ document: { addEventListener() {} } });
  vm.runInContext(read('60-accordion-core.js'), s);
  Object.assign(s, { ensureSystemSections() {}, saveToLocalStorage() {}, renderAccordion() {},
    getOpenItemRefs: () => [], reopenItemRefs() {}, applyManualSearch() { refreshed++; } });
  s.saveAndRender();
  assert.equal(refreshed, 1);
});

test('failed save prevents switching away from unsaved content', () => {
  const { s, entries } = setup();
  entries.set('manualData(B)', JSON.stringify({ manualName: 'B', menu: [] }));
  s.localStorage.setItem = () => { throw Error('QuotaExceededError'); };
  s.manualData.menu[0].content = '저장 실패한 내용';
  s.selectStorageKey('manualData(B)');
  assert.equal(s.activeStorageKey, 'manualData(A)');
  assert.equal(s.manualData.menu[0].content, '저장 실패한 내용');
});

test('description deletion survives JSON reload for current and legacy backups', () => {
  const { s } = setup();
  vm.runInContext(read('30-markdown-reference.js'), s);
  s.getDefaultReferenceSectionTitle = () => '참조';
  s.getItemByPath = p => s.manualData.menu[p[0]];
  s.getSiblingArrayByPath = () => s.manualData.menu;
  s.getOpenItemRefs = () => [];
  s.renderAccordion = () => {};
  s.saveAndRender = () => s.ensureDescriptionSection();
  for (const migrated of [true, false, undefined]) {
    s.manualData = { menu: [{ title: '참조', isReferenceSection: true },
      { title: '매뉴얼 설명', isDescriptionSection: true, children: [{ title: '하위' }] },
      { title: '업무' }], descriptionSectionMigrated: migrated };
    s.confirm = () => false;
    s.deleteItem([1]);
    assert.equal(s.manualData.menu.length, 3);
    s.confirm = () => true;
    s.deleteItem([1]);
    s.manualData = JSON.parse(JSON.stringify(s.manualData));
    s.ensureDescriptionSection();
    assert.deepEqual(s.manualData.menu.map(n => n.title), ['참조','업무']);
    assert.equal(s.manualData.menu.some(n => n.isDescriptionSection), false);
    s.deleteItem([0]);
    assert.equal(s.manualData.menu.length, 2);
  }
});

test('deeply nested headers retain valid and progressively darker colors', () => {
  const s = vm.createContext({});
  vm.runInContext(read('70-accordion-render.js'), s);
  let previous = 256;
  for (const depth of [0,1,2,4,8,20]) {
    const styles = {};
    s.applyHeaderDepthColor({ style: { setProperty: (k,v) => { styles[k] = v; } } }, depth);
    for (const color of Object.values(styles)) {
      const channels = color.match(/-?\d+/g).map(Number);
      assert.ok(channels.every(c => c >= 0 && c <= 255));
    }
    const red = Number(styles['--accordion-header-bg'].match(/\d+/)[0]);
    assert.ok(red <= previous);
    previous = red;
  }
});

test('ordinary save does not rebuild the manual selector; a rename still refreshes it',()=>{
 const {s}=setup();let refreshes=0;s.refreshStorageKeyMenu=()=>refreshes++;
 s.manualData.menu[0].content='수정 내용';assert.equal(s.saveToLocalStorage(true),true);assert.equal(refreshes,0);
 s.manualData.manualName='새 이름';assert.equal(s.saveToLocalStorage(true),true);
 assert.equal(s.activeStorageKey,'manualData(새 이름)');assert.equal(refreshes,1);
});

test('undo keeps the latest 50 changes and stops at that boundary',()=>{
 const {s}=setup();for(let i=1;i<=65;i++){s.manualData.menu[0].content=String(i);s.saveToLocalStorage();}
 for(let i=0;i<50;i++)s.undoLastEdit();assert.equal(s.manualData.menu[0].content,'15');
 s.undoLastEdit();assert.equal(s.manualData.menu[0].content,'15');
});

test('undo restores viewport and opens panels without expansion animations before scrolling', () => {
  const { s } = setup();
  const snapshot = { top: 730, alignedPath: '0', panels: [{id:'global-content',top:250},{id:'dictionary-body',top:90}] };
  const order = [];
  s.captureAccordionViewport = () => { order.push('capture'); return snapshot; };
  s.getOpenItemPaths = () => [[0]];
  s.getItemByPath = path => s.manualData.menu[path[0]];
  s.renderAll = () => order.push('render');
  s.reopenPath = (path, animate) => { assert.equal(path[0],0); assert.equal(animate,false); order.push('open'); };
  s.restoreAccordionViewport = value => { assert.equal(value,snapshot); order.push('restore'); };
  s.manualData.menu[0].content = '변경 후'; s.saveToLocalStorage(); s.undoLastEdit();
  assert.equal(s.manualData.menu[0].content,'초기');
  assert.deepEqual(order,['capture','render','open','restore']);
});
