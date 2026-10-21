const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'../src',name),'utf8');

test('lazy body is absent until requested, reused in one mode and refreshed without replacing child headers',()=>{
 const s={currentMode:'read'};vm.createContext(s);vm.runInContext(read('js/69-accordion-body.js'),s);
 const item={content:'{{원본}}',tables:[{cells:[['값']]}]},before=JSON.stringify(item),created=[];let removed=0;
 s.createAccordionBody=(received,path)=>{assert.equal(received,item);assert.equal(path[0],2);const body={mode:s.currentMode};created.push(body);return body;};
 const panel={prepend(value){this.body=value;},querySelectorAll(selector){assert.equal(selector,':scope > pre, :scope > .manual-table-wrap');return [{remove(){removed++;}}];}};
 s.registerAccordionBody(panel,item,[2]);assert.equal(created.length,0);
 s.ensureAccordionBody(panel);s.ensureAccordionBody(panel);assert.equal(created.length,1);assert.equal(panel.body.mode,'read');
 s.currentMode='edit';s.ensureAccordionBody(panel);assert.equal(created.length,2);assert.equal(removed,1);assert.equal(JSON.stringify(item),before);
});

test('opening materializes body before expansion and an unchanged open state does no presentation work',()=>{
 const s={document:{addEventListener(){}}};vm.createContext(s);vm.runInContext(read('js/60-accordion-core.js'),s);const events=[];let open=false;
 const header={classList:{toggle(){}},querySelector:()=>({setAttribute(){}})};
 const panel={classList:{contains:()=>open,toggle:(key,value)=>{open=value;events.push('expand');}},previousElementSibling:header};
 s.ensureAccordionBody=()=>events.push('body');s.updateAccordionTitleConveyor=()=>events.push('theme');s.animateAccordionExpansion=()=>events.push('animate');
 s.setAccordionExpanded(panel,true,{animate:false});assert.deepEqual(events,['body','expand','theme']);
 events.length=0;s.setAccordionExpanded(panel,true,{animate:false});assert.deepEqual(events,['body']);
});

test('mode switch restores open bodies before search and geometry without rebuilding storage menus or normalizing data',()=>{
 const order=[],snapshot={top:200},open=[{}],s={currentMode:'read',captureAccordionViewport:()=>snapshot,getOpenItemRefs:()=>open,
  renderAll(){throw Error('Full render is not a mode switch');},ensureSystemSections(){throw Error('No data normalization');},refreshStorageKeyMenu(){throw Error('No saved menu rebuild');},
  updateLayoutResizerState:options=>{assert.equal(options.measure,false);order.push('class');},renderGlobal:()=>order.push('global'),
  renderAccordion:options=>{assert.equal(options.normalize,false);order.push('headers');},reopenItemRefs:(items,animate)=>{assert.equal(items,open);assert.equal(animate,false);order.push('bodies');},
  applyManualSearch:()=>order.push('search'),updateModeButton:()=>order.push('button'),restoreAccordionViewport:value=>{assert.equal(value,snapshot);order.push('scroll');},
  syncLayoutResizerPosition:()=>order.push('geometry'),syncManualThemeEffect:()=>order.push('theme')};
 vm.createContext(s);vm.runInContext(read('js/90-editing.js'),s);s.toggleMode();
 assert.equal(s.currentMode,'edit');assert.deepEqual(order,['class','global','headers','bodies','search','button','scroll','geometry','theme']);
});

test('pixel requests share one frame and leaving the theme cancels pending work',()=>{
 const frames=new Map();let next=0,effect,runs=0;const s={document:{querySelectorAll:()=>[]},requestAnimationFrame:fn=>{frames.set(++next,fn);return next;},cancelAnimationFrame:id=>frames.delete(id),registerManualThemeEffect:(id,value)=>{assert.equal(id,'pixel');effect=value;}};
 vm.createContext(s);vm.runInContext(read('themes/pixel.js'),s);s.refreshThemeConveyors=()=>runs++;
 effect.refresh();effect.refresh();effect.updateHeader(null,true);assert.equal(frames.size,1);
 const [id,callback]=[...frames][0];frames.delete(id);callback();assert.equal(runs,1);
 effect.refresh();assert.equal(frames.size,1);effect.dispose();assert.equal(frames.size,0);assert.equal(runs,1);
});

test('layout resizer avoids repeated inherited-style writes and can defer geometry until after opening',()=>{
 const properties=new Map();let writes=0,reads=0;const layout={clientWidth:1000},s={currentMode:'edit',document:{documentElement:{style:{getPropertyValue:key=>properties.get(key),setProperty:(key,value)=>{properties.set(key,value);writes++;}}},body:{classList:{toggle(){}}},querySelector:()=>layout,getElementById:()=>null},getComputedStyle:()=>{reads++;return {paddingLeft:'20px',paddingRight:'20px'};}};
 vm.createContext(s);vm.runInContext(read('js/55-layout-resizer.js'),s);
 s.updateLayoutResizerState({measure:false});assert.equal(reads,0);s.syncLayoutResizerPosition();s.syncLayoutResizerPosition();assert.equal(writes,1);
});
