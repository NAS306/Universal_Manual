const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'../src/js',name),'utf8');
const catalog=require('../lib/theme-catalog').loadThemeCatalog(path.join(__dirname,'../src'));
function setup(){const s={getManualThemeDefinition:value=>catalog.find(theme=>theme.id===value)||catalog[0],document:{documentElement:{dataset:{theme:'modern'}}},window:{matchMedia:()=>({matches:false})}};vm.createContext(s);vm.runInContext(read('26-motion.js')+'\n'+read('27-reading-preferences.js'),s);return s;}
test('text size accepts only the six supported choices',()=>{const s=setup();for(const size of ['atomic','tiny','small','normal','large','larger'])assert.equal(s.normalizeManualTextSize(size),size);for(const size of [null,'','__proto__','giant'])assert.equal(s.normalizeManualTextSize(size),'normal');});
test('motion reduction follows system preference unless always-reduce is selected',()=>{
 const s=setup();assert.equal(s.manualMotionEnabled(),true);s.window.matchMedia=()=>({matches:true});assert.equal(s.manualMotionEnabled(),false);s.window.matchMedia=()=>({matches:false});vm.runInContext("manualMotionPreference='reduce'",s);assert.equal(s.manualMotionEnabled(),false);assert.equal(s.normalizeManualMotionPreference('unknown'),'system');
});
test('font changes update style and storage while restoring the accordion viewport',()=>{
 const s=setup(),stored=new Map(),styles=new Map(),select={value:''},snapshot={anchor:'same body block'};let restored;
 s.document={documentElement:{style:{setProperty:(key,value)=>styles.set(key,value)}},getElementById:()=>select};s.localStorage={setItem:(key,value)=>stored.set(key,value)};
 s.captureAccordionViewport=()=>snapshot;s.restoreAccordionViewport=value=>{restored=value;};
 for (const [size,scale] of [['atomic','0.7'],['tiny','0.8'],['larger','1.2']]) {
  s.applyManualTextSize(size,true);
  assert.equal(styles.get('--manual-font-scale'),scale);assert.equal(stored.get('universalManual.bodyTextSize'),size);assert.equal(select.value,size);assert.equal(restored,snapshot);
 }
});
test('dictionary settings and panel selectors share the same saved mode',()=>{
 const s={window:{addEventListener(){}}},stored=new Map(),selects=[{value:'push'},{value:'push'}];vm.createContext(s);vm.runInContext(read('56-dictionary.js'),s);s.document={querySelectorAll:()=>selects};s.localStorage={setItem:(key,value)=>stored.set(key,value)};
 s.setDictionaryMode('overlay-left');assert.ok(selects.every(select=>select.value==='overlay-left'));assert.equal(stored.get('universalManual.dictionaryMode'),'overlay-left');s.setDictionaryMode('invalid');assert.ok(selects.every(select=>select.value==='push'));
});

test('office theme locks motion without overwriting the preference, then restores it on exit',()=>{
 const s=setup(),stored=new Map(),rootClasses=new Set(),fieldClasses=new Set();let settled=0;
 const toggle=(set,key,on)=>{if(on)set.add(key);else set.delete(key);};
 const field={classList:{toggle:(key,on)=>toggle(fieldClasses,key,on)},removeAttribute(key){delete this[key];}};
 const select={value:'',disabled:false,closest:()=>field};
 s.document.documentElement.classList={toggle:(key,on)=>toggle(rootClasses,key,on)};
 s.document.getElementById=()=>select;s.document.getAnimations=()=>[{finish(){settled++;}}];
 s.localStorage={setItem:(key,value)=>stored.set(key,value)};
 s.applyManualMotionPreference('system',true);
 s.document.documentElement.dataset.theme='boringAndCliche';s.syncManualMotionState();
 assert.equal(s.manualMotionEnabled(),false);assert.equal(select.disabled,true);assert.equal(select.value,'reduce');
 assert.equal(field.title,'관공서 테마에서 애니메이션은 사치입니다.');assert(fieldClasses.has('motion-locked'));assert(rootClasses.has('reduce-motion'));assert.equal(settled,1);
 assert.equal(stored.get('universalManual.motionPreference'),'system');
 s.document.documentElement.dataset.theme='modern';s.syncManualMotionState();
 assert.equal(select.disabled,false);assert.equal(select.value,'system');assert.equal(field.title,undefined);assert(!fieldClasses.has('motion-locked'));assert(!rootClasses.has('reduce-motion'));assert.equal(s.manualMotionEnabled(),true);
 s.applyManualMotionPreference('reduce',true);s.document.documentElement.dataset.theme='boringAndCliche';s.syncManualMotionState();s.document.documentElement.dataset.theme='pixel';s.syncManualMotionState();
 assert.equal(select.disabled,false);assert.equal(select.value,'reduce');assert.equal(s.manualMotionEnabled(),false);assert.equal(stored.get('universalManual.motionPreference'),'reduce');
});
