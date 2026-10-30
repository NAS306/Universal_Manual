const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async()=>{
  const browser = await chromium.launch({headless:true});
  try {
    const context = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,offline:true});
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    const errors = [];
    page.on('pageerror',error=>{errors.push(error.message);console.error(error.message);});
    await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
    await page.waitForSelector('#main-accordion > .accordion-item',{state:'attached'});
    await page.evaluate(()=>{
      const data = UniversalManual.debug.getManualData();
      const term = data.menu.find(item=>item.isDictionarySection).children[0].title.split('&')[0].trim();
      data.menu.unshift(...['모바일 A','모바일 B'].map(title=>({title,content:term+'\n'+Array.from({length:80},(_,i)=>title+' 본문 '+i).join('\n'),images:[],tables:[],children:[]})));
      data.globalTabs[0].content = Array.from({length:80},(_,i)=>'전역 매뉴얼 '+i).join('\n');
      localStorage.setItem(UniversalManual.debug.getActiveStorageKey(),JSON.stringify(data));
    });
    await page.reload();
    await page.waitForSelector('#main-accordion > .accordion-item',{state:'attached'});
    const openSettings = async()=>{
      await page.getByRole('button',{name:'메뉴얼 관리 메뉴',exact:true}).click();
      await page.getByRole('button',{name:'설정',exact:true}).click();
    };
    const setLayout = async value=>{
      await openSettings();
      assert.equal(await page.locator('#settings-panel-layout').isEnabled(),true);
      await page.locator('#settings-panel-layout').selectOption(value);
      await page.getByRole('button',{name:'설정 닫기',exact:true}).click();
    };
    const visiblePane = ()=>page.locator('[data-manual-pane]:visible');
    const currentSection = ()=>page.locator('.mobile-section-nav [aria-pressed="true"]').textContent();
    const tick = ()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const screenshot = async name=>{
      const target = path.resolve(__dirname,'..',name+'.png');
      if (fs.existsSync(target)) fs.copyFileSync(target,path.resolve(__dirname,'..',name+'_BU.png'));
      await page.screenshot({path:target});
    };
    for (const theme of ['modern','oldAndFaithful','boringAndCliche','matrix','pixel']) {
      await openSettings();
      await page.locator('#settings-theme input[value="'+theme+'"]').check();
      await page.getByRole('button',{name:'설정 닫기',exact:true}).click();
      for (const [width,height] of [[320,760],[390,844],[768,1024],[915,412]]) {
        await page.setViewportSize({width,height});
        assert((await page.locator('.app-header').boundingBox()).height<=48,theme+' compact header at '+width);
        assert.equal(await visiblePane().count(),1);
        const pane = await visiblePane().boundingBox(),layout = await page.locator('.main-layout').boundingBox();
        assert(pane.width>=layout.width-16 && pane.height>=layout.height-16,theme+' full section at '+width);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,theme+' no horizontal overflow');
      }
    }
    await page.setViewportSize({width:390,height:844});
    await openSettings();
    await page.locator('#settings-theme input[value="modern"]').check();
    await page.getByRole('button',{name:'설정 닫기',exact:true}).click();
    const initial = await page.evaluate(()=>JSON.stringify(UniversalManual.debug.getManualData()));
    for (const value of ['global','body','global-global','global-body','body-body','body-global']) {
      await setLayout(value);
      await page.locator('#mobile-section-1').click();
      assert.equal(await visiblePane().count(),1,value);
      assert.equal(await page.locator('#mobile-section-2').isVisible(),value.includes('-'));
      if (value.includes('-')) {
        await page.locator('#mobile-section-2').click();
        assert.equal(await currentSection(),'2');
        assert.equal(await visiblePane().evaluate(el=>el.inert),false);
        assert.equal(await page.locator('[data-mobile-inactive="true"]').evaluate(el=>el.inert),true);
      }
    }
    assert.equal(await page.evaluate(()=>JSON.stringify(UniversalManual.debug.getManualData())),initial,'presentation does not change data');
    await setLayout('global-body');
    await page.locator('#mobile-section-1').click();
    const cdp = await context.newCDPSession(page);
    const send = (type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map((point,id)=>({x:point[0],y:point[1],id,radiusX:4,radiusY:4,force:1}))});
    const gesture = async (start,end)=>{
      await page.evaluate(()=>{
        window.testTouchEvents = [];
        if (!window.testTouchObserver) {
          window.testTouchObserver = true;
          document.addEventListener('touchmove',event=>window.testTouchEvents.push({prevented:event.defaultPrevented,count:event.touches.length}));
        }
      });
      await send('touchStart',start);
      for (let step=1;step<=6;step++) await send('touchMove',start.map((point,index)=>point.map((value,axis)=>value+(end[index][axis]-value)*step/6)));
      await send('touchEnd',[]);
      await tick();
    };
    await page.locator('#global-content').evaluate(el=>{el.scrollTop=180;});
    const globalScroll = await page.locator('#global-content').evaluate(el=>el.scrollTop);
    await gesture([[260,240],[260,320]],[[130,240],[130,320]]);
    assert.equal(await currentSection(),'2','native two-finger left swipe advances');
    assert.equal(await page.evaluate(()=>window.testTouchEvents.some(event=>event.prevented)),true);
    await page.locator('#main-accordion').getByRole('button',{name:'모바일 A',exact:true}).click();
    await visiblePane().evaluate(el=>{el.scrollTop=220;});
    const bodyScroll = await visiblePane().evaluate(el=>el.scrollTop);
    await gesture([[120,240],[120,320]],[[250,240],[250,320]]);
    assert.equal(await currentSection(),'1','native two-finger right swipe returns');
    assert.equal(await page.locator('#global-content').evaluate(el=>el.scrollTop),globalScroll,'global scroll preserved');
    await gesture([[260,240],[260,320]],[[130,240],[130,320]]);
    assert.equal(await visiblePane().evaluate(el=>el.scrollTop),bodyScroll,'body scroll preserved');
    assert.equal(await page.locator('#main-accordion > .accordion-item > .accordion-content.open').count(),1,'open item preserved');
    await gesture([[250,240]],[[100,240]]);
    assert.equal(await currentSection(),'2','single-finger swipe ignored');
    assert.equal(await page.evaluate(()=>window.testTouchEvents.every(event=>!event.prevented)),true);
    await gesture([[170,240],[170,320]],[[90,240],[250,320]]);
    assert.equal(await currentSection(),'2','pinch ignored');
    assert.equal(await page.evaluate(()=>window.testTouchEvents.every(event=>!event.prevented)),true,'native pinch is not blocked');
    await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:1});
    await gesture([[150,280],[230,280]],[[150,180],[230,180]]);
    assert.equal(await currentSection(),'2','two-finger vertical scroll ignored');
    await gesture([[240,240],[240,300],[240,360]],[[100,240],[100,300],[100,360]]);
    assert.equal(await currentSection(),'2','three fingers ignored');
    await page.locator('#mobile-section-1').click();
    await gesture([[120,240],[120,320]],[[250,240],[250,320]]);
    assert.equal(await currentSection(),'1','no wrap at first section');
    await page.getByRole('button',{name:'수정 모드 켜기',exact:true}).click();
    await gesture([[260,240],[260,320]],[[130,240],[130,320]]);
    assert.equal(await currentSection(),'1','editable content does not navigate');
    await page.locator('#global-content').fill('모바일에서도 편집 저장');
    await page.locator('#mobile-section-2').click();
    await page.getByRole('button',{name:'편집 완료',exact:true}).click();
    await page.locator('#mobile-section-1').click();
    assert.equal(await page.locator('#global-content').textContent(),'모바일에서도 편집 저장');
    await page.getByRole('button',{name:'검색창 열기',exact:true}).click();
    await page.locator('#manual-search-input').fill('모바일 B');
    await page.waitForFunction(()=>document.getElementById('manual-search-count').textContent.includes('1 / 1'));
    assert.equal(await currentSection(),'2','search reveals its body section');
    assert.equal(await page.locator('#main-accordion .search-current .accordion-toggle').textContent(),'모바일 B');
    await page.locator('#manual-search-input').press('Escape');
    assert((await page.locator('.app-header').boundingBox()).height<=48,'search collapses again');
    await page.waitForFunction(()=>document.getAnimations().every(animation=>animation.effect?.getComputedTiming().endTime === Infinity || animation.playState !== 'running'));
    await page.waitForFunction(()=>{
      const pane = document.querySelector('[data-pane-slot="1"]');
      return pane.querySelector('.search-current').getBoundingClientRect().top < pane.getBoundingClientRect().top+140;
    });
    await screenshot('preview-mobile-workspace');
    await page.setViewportSize({width:1440,height:960});
    await tick();
    assert.equal(await visiblePane().count(),2,'desktop restores configured two-pane layout');
    assert.equal(await page.locator('#settings-panel-layout').inputValue(),'global-body');
    assert.equal(await page.locator('#mobile-search-toggle').isVisible(),false);
    assert.deepEqual(errors,[],'browser runtime errors');
    console.log('PASS: compact five-theme header, six mobile layouts, native multi-touch navigation, gesture exclusions, preserved scroll/editing, search reveal, desktop restoration, offline execution');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
