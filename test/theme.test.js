const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../src/js/29-theme.js'),'utf8');
const catalog=require('../lib/theme-catalog').loadThemeCatalog(path.join(__dirname,'../src'));
const metadata=catalog.map(theme=>({...theme,aliases:theme.aliases||[]}));
const pixel=fs.readFileSync(path.join(__dirname,'../src/themes/pixel.js'),'utf8');
function setup(){const s={MANUAL_THEMES:metadata,manualMotionEnabled:()=>true,syncManualMotionState:()=>s.syncManualThemeEffect()};vm.createContext(s);vm.runInContext(source+'\n'+pixel,s);return s;}
test('theme accepts five canonical IDs, reads earlier preferences and falls back safely',()=>{
 const s=setup();for(const value of ['modern','oldAndFaithful','pixel','boringAndCliche','matrix'])assert.equal(s.normalizeManualTheme(value),value);
 assert.equal(s.normalizeManualTheme('default'),'modern');assert.equal(s.normalizeManualTheme('pixelbeat'),'pixel');
 for(const value of [null,'','__proto__','other','oldandfaithful','boringandcliche'])assert.equal(s.normalizeManualTheme(value),'modern');
});

test('theme selection syncs radios and storage, restores the viewport and leaves manual data unchanged',()=>{
 const s=setup(),stored=new Map(),inputs=['modern','oldAndFaithful','pixel','boringAndCliche','matrix'].map(value=>({value,checked:false})),snapshot={anchor:'same block'};let restored,layoutSync=0;
 s.manualData={menu:[{title:'業務',content:'기존 데이터'}]};const before=JSON.stringify(s.manualData);
 s.document={documentElement:{dataset:{}},querySelectorAll:()=>inputs};s.localStorage={setItem:(key,value)=>stored.set(key,value)};
 s.syncManualThemeEffect=()=>{};s.captureAccordionViewport=()=>snapshot;s.restoreAccordionViewport=value=>{restored=value;};s.syncLayoutResizerPosition=()=>layoutSync++;
 for(const value of ['modern','oldAndFaithful','pixel','boringAndCliche','matrix']){
  s.applyManualTheme(value,true);assert.equal(s.document.documentElement.dataset.theme,value);assert.equal(stored.get('universalManual.theme'),value);
  assert.deepEqual(inputs.filter(input=>input.checked).map(input=>input.value),[value]);assert.equal(restored,snapshot);assert.equal(JSON.stringify(s.manualData),before);
 }
 assert.equal(layoutSync,5);
 s.applyManualTheme('pixelbeat');assert.equal(s.document.documentElement.dataset.theme,'pixel');assert.equal(inputs.find(input=>input.value==='pixel').checked,true);
});

test('conveyor repeats cover the viewport with a spare unit and handle unavailable measurements',()=>{
 const s=setup();assert.equal(s.getThemeConveyorRepeatCount(300,100),4);assert.equal(s.getThemeConveyorRepeatCount(350,100),5);assert.equal(s.getThemeConveyorRepeatCount(100,300),2);assert.equal(s.getThemeConveyorRepeatCount(100,0),2);
});

test('an earlier pixel preference keeps ticker and open-title conveyors on the canonical pixel route',()=>{
 const s=setup();let refreshed=0,cleared=0;
 const belts=[{replaceChildren(){cleared++;}},{replaceChildren(){cleared++;}}];
 s.document={documentElement:{dataset:{}},querySelectorAll:selector=>selector.includes('input[name=')?[]:belts};
 s.syncLayoutResizerPosition=()=>{};s.refreshThemeConveyor=()=>{refreshed++;};
 s.applyManualTheme('pixelbeat');assert.equal(s.document.documentElement.dataset.theme,'pixel');assert.equal(refreshed,2);assert.equal(cleared,0);
 s.updateAccordionTitleConveyor({querySelector:()=>belts[0]},true);assert.equal(refreshed,3);assert.equal(cleared,0);
 s.applyManualTheme('boringAndCliche');assert.equal(cleared,2);
});
