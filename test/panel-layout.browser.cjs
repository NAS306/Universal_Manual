// Isolated browser profile: never loads or edits the user's browser data.
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const fs = require('node:fs');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async()=>{
  const browser = await chromium.launch({headless:true});
  try {
    const context = await browser.newContext({viewport:{width:1440,height:960},offline:true});
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    const errors = [];
    page.on('pageerror',error=>{errors.push(error.message); console.error('pageerror',error.message);});
    await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
    await page.waitForSelector('#main-accordion > .accordion-item');
    const initial = await page.evaluate(()=>JSON.stringify(UniversalManual.debug.getManualData()));
    const setLayout = async value=>{
      await page.getByRole('button',{name:'메뉴얼 관리 메뉴',exact:true}).click();
      await page.getByRole('button',{name:'설정',exact:true}).click();
      await page.locator('#settings-panel-layout').selectOption(value);
      await page.getByRole('button',{name:'설정 닫기',exact:true}).click();
    };
    const screenshot = async name=>{
      const target = path.resolve(__dirname,'..',name+'.png');
      if (fs.existsSync(target)) fs.copyFileSync(target,path.resolve(__dirname,'..',name+'_BU.png'));
      await page.screenshot({path:target,fullPage:true});
    };
    for (const [value,kinds] of Object.entries({global:['global'],body:['body'],'global-global':['global','global'],'global-body':['global','body'],'body-body':['body','body'],'body-global':['body','global']})) {
      await setLayout(value);
      const panes = await page.locator('[data-manual-pane]:visible').evaluateAll(elements=>elements.map(el=>({kind:el.dataset.manualPane,slot:+el.dataset.paneSlot,x:el.getBoundingClientRect().x,w:el.getBoundingClientRect().width})).sort((a,b)=>a.slot-b.slot));
      assert.deepEqual(panes.map(p=>p.kind),kinds,value);
      assert(panes.every(p=>p.w>300),value+' pane width');
      if (panes.length===1) assert(panes[0].w>1300,value+' full width');
      else assert(panes[0].x<panes[1].x,value+' order');
      assert.equal(await page.evaluate(()=>JSON.stringify(UniversalManual.debug.getManualData())),initial,'layout must not change manual data');
    }
    await setLayout('body-body');
    const left = page.locator('#main-accordion'),right = page.locator('#main-accordion-secondary');
    await left.locator(':scope > .accordion-item > .accordion-header .accordion-toggle').nth(0).click();
    await right.locator(':scope > .accordion-item > .accordion-header .accordion-toggle').nth(1).click();
    assert.equal(await left.locator(':scope > .accordion-item > .accordion-content.open').count(),1);
    assert.equal(await right.locator(':scope > .accordion-item > .accordion-content.open').count(),1);
    const leftPath = await left.locator(':scope > .accordion-item > .accordion-content.open').evaluate(el=>el.parentElement.dataset.path);
    const rightPath = await right.locator(':scope > .accordion-item > .accordion-content.open').evaluate(el=>el.parentElement.dataset.path);
    assert.notEqual(leftPath,rightPath);
    await page.getByRole('button',{name:'수정 모드 켜기',exact:true}).click();
    assert.equal(await left.locator(':scope > .accordion-item > .accordion-content.open').evaluate(el=>el.parentElement.dataset.path),leftPath);
    assert.equal(await right.locator(':scope > .accordion-item > .accordion-content.open').evaluate(el=>el.parentElement.dataset.path),rightPath);
    const editor = left.locator(':scope > .accordion-item > .accordion-content.open > pre');
    await editor.fill('독립 본문 편집 검증');
    await page.getByRole('button',{name:'편집 완료',exact:true}).click();
    assert.equal(await page.evaluate(path=>UniversalManual.debug.getManualData().menu[+path].content,leftPath),'독립 본문 편집 검증');
    await right.locator(':scope > .accordion-item > .accordion-header .accordion-toggle').nth(+leftPath).click();
    assert.equal(await right.locator(':scope > .accordion-item > .accordion-content.open > pre').textContent(),'독립 본문 편집 검증');
    await page.getByRole('button',{name:'수정 모드 켜기',exact:true}).click();
    const rightEditor = right.locator(':scope > .accordion-item > .accordion-content.open > pre');
    await rightEditor.fill('오른쪽 본문 수정');
    await rightEditor.press('Control+z');
    assert.equal(await right.locator(':scope > .accordion-item > .accordion-content.open > pre').textContent(),'독립 본문 편집 검증');
    assert.equal(await left.locator(':scope > .accordion-item > .accordion-content.open > pre').textContent(),'독립 본문 편집 검증');
    page.once('dialog',dialog=>dialog.accept('검색 대상 업무'));
    await left.locator(':scope > .level-add-row button').click();
    assert.equal(await right.getByRole('button',{name:'검색 대상 업무',exact:true}).count(),1,'structural edits update both views');
    await left.getByRole('button',{name:'검색 대상 업무',exact:true}).click();
    const term = await page.evaluate(()=>UniversalManual.debug.getManualData().menu.find(item=>item.isDictionarySection).children[0].title.split('&')[0].trim());
    await left.locator(':scope > .accordion-item > .accordion-content.open > pre').fill('고유검색 검증 '+term);
    await page.getByRole('button',{name:'편집 완료',exact:true}).click();
    await left.locator(':scope > .accordion-item > .accordion-header .accordion-toggle').nth(+leftPath).click();
    await right.locator(':scope > .accordion-item > .accordion-content.open > pre').click();
    await page.locator('#manual-search-input').fill('고유검색');
    await page.waitForFunction(()=>document.getElementById('manual-search-count').textContent.includes('1 / 1'));
    assert.equal(await right.locator('.search-current .accordion-toggle').textContent(),'검색 대상 업무');
    assert.equal(await left.locator(':scope > .accordion-item > .accordion-content.open').evaluate(el=>el.parentElement.dataset.path),leftPath,'search preserves other view');
    await page.locator('#manual-search-input').fill('');
    await page.waitForFunction(()=>document.getElementById('manual-search-count').textContent.includes('검색어를 입력'));
    await right.locator('.dictionary-term').getByText(term,{exact:true}).click();
    await page.waitForSelector('#dictionary-panel:not([hidden])');
    for (const mode of ['push','compress','overlay-left','overlay-right']) {
      await page.locator('.dictionary-toolbar select').selectOption(mode);
      assert.equal(await page.locator('[data-pane-slot="0"]').evaluate(el=>el.inert),mode==='push');
      assert.equal(await page.locator('[data-pane-slot="1"]').evaluate(el=>el.inert),false);
    }
    await page.getByRole('button',{name:'사전 닫기',exact:true}).click();
    await page.waitForSelector('#dictionary-panel',{state:'hidden'});
    await page.getByRole('button',{name:'메뉴얼 관리 메뉴',exact:true}).click();
    await page.getByRole('button',{name:'설정',exact:true}).click();
    await page.locator('#accordion-align-toggle').check();
    await page.getByRole('button',{name:'설정 닫기',exact:true}).click();
    await left.getByRole('button',{name:'검색 대상 업무',exact:true}).click();
    await right.getByRole('button',{name:'사전',exact:true}).click();
    const rightScroll = await right.evaluate(el=>el.parentElement.scrollTop);
    assert(rightScroll>0,'right header aligned at viewport top');
    await left.getByRole('button',{name:'검색 대상 업무',exact:true}).click();
    await page.waitForFunction(()=>document.getAnimations().every(animation=>animation.effect?.getComputedTiming().endTime === Infinity || animation.playState !== 'running'));
    assert.equal(await right.evaluate(el=>el.parentElement.scrollTop),rightScroll,'closing one view preserves the aligned scroll of the other');
    await setLayout('global-global');
    // Create a second tab through the existing UI, then navigate the two views independently.
    await page.getByRole('button',{name:'수정 모드 켜기',exact:true}).click();
    page.once('dialog',dialog=>dialog.accept('탭 검증'));
    await page.locator('[data-pane-copy="0"] .global-tab-add').click();
    const globalLeft = page.locator('[data-manual-pane="global"][data-pane-copy="0"]');
    const globalRight = page.locator('[data-manual-pane="global"][data-pane-copy="1"]');
    assert.equal(await globalLeft.locator('.global-tab.active .global-tab-title').textContent(),'탭 검증');
    assert.notEqual(await globalRight.locator('.global-tab.active .global-tab-title').textContent(),'탭 검증');
    await globalLeft.locator('[data-global-editor]').fill('두 번째 전역 탭 내용');
    await globalRight.locator('.global-tab').filter({hasText:'탭 검증'}).click();
    assert.equal(await globalRight.locator('[data-global-editor]').textContent(),'두 번째 전역 탭 내용');
    await globalRight.locator('[data-global-editor]').fill('오른쪽에서 공유 내용 수정');
    assert.equal(await globalLeft.locator('[data-global-editor]').textContent(),'오른쪽에서 공유 내용 수정');
    for (const theme of ['modern','oldAndFaithful','boringAndCliche','matrix','pixel']) {
      await page.getByRole('button',{name:'메뉴얼 관리 메뉴',exact:true}).click();
      await page.getByRole('button',{name:'설정',exact:true}).click();
      await page.locator('#settings-theme input[value="'+theme+'"]').check();
      await page.getByRole('button',{name:'설정 닫기',exact:true}).click();
      const colors = await page.locator('[data-global-editor]').evaluateAll(elements=>elements.map(el=>{const style=getComputedStyle(el);return [style.backgroundColor,style.color,style.fontSize];}));
      assert.deepEqual(colors[0],colors[1],theme+' shared theme');
    }
    await page.getByRole('button',{name:'편집 완료',exact:true}).click();
    await page.reload();
    await page.waitForSelector('[data-manual-pane="global"][data-pane-copy="1"]:not([hidden])');
    assert.equal(await page.locator('#settings-panel-layout').inputValue(),'global-global');
    assert.equal(await page.locator('#global-content').textContent(),'오른쪽에서 공유 내용 수정');
    const ids = await page.locator('[id]').evaluateAll(elements=>elements.map(el=>el.id));
    assert.equal(new Set(ids).size,ids.length,'unique DOM IDs');
    await setLayout('body-global');
    await page.setViewportSize({width:390,height:844});
    await page.waitForSelector('[data-mobile-inactive="true"]',{state:'attached'});
    assert.equal(await page.locator('[data-manual-pane]:visible').count(),1);
    assert.equal(await page.locator('[data-manual-pane]:visible').getAttribute('data-manual-pane'),'body');
    await page.locator('#mobile-section-2').click();
    assert.equal(await page.locator('[data-manual-pane]:visible').getAttribute('data-manual-pane'),'global');
    await screenshot('preview-panel-layout-mobile');
    for (const value of ['body','global']) {
      await setLayout(value);
      const pane = await page.locator('[data-manual-pane]:visible').boundingBox();
      const layout = await page.locator('.main-layout').boundingBox();
      assert(pane.height>layout.height-40,'mobile single pane uses the available height');
    }
    await page.setViewportSize({width:1440,height:960});
    await setLayout('body-body');
    await screenshot('preview-panel-layout');
    assert.deepEqual(errors,[],'browser runtime errors');
    console.log('PASS: six layouts, independent navigation, shared editing, persistence, unique IDs, mobile order and offline file execution');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
