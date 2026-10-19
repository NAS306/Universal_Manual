const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),vm=require('node:vm');
const {loadThemeCatalog,validateThemeCatalog}=require('../lib/theme-catalog');
const src=path.join(__dirname,'../src'),catalog=loadThemeCatalog(src),clone=()=>JSON.parse(JSON.stringify(catalog));
const source=fs.readFileSync(path.join(src,'js/29-theme.js'),'utf8');
function runtime(entries=catalog){const s={MANUAL_THEMES:entries.map(theme=>({...theme,aliases:theme.aliases||[]})),manualMotionEnabled:()=>true,document:{hidden:false,documentElement:{dataset:{theme:'modern'}}}};vm.createContext(s);vm.runInContext(source,s);return s;}

test('catalog rejects duplicate IDs and aliases, including aliases of later themes',()=>{
 for(const modify of [list=>list.push({...list[1]}),list=>list[1].aliases=['default'],list=>list[0].aliases.push('matrix')]){const list=clone();modify(list);assert.throws(()=>validateThemeCatalog(list,src),/duplicate/);}
});
test('catalog catches misspelled fields, missing resources and paths outside src',()=>{
 for(const [change,error] of [[entry=>entry.stlyes=[],/Unknown/],[entry=>entry.styles=['styles/not-here.css'],/Missing/],[entry=>entry.styles=['../outside.css'],/inside src/],[entry=>entry.script='themes/catalog.json',/Invalid theme resource/]]){const list=clone();change(list[1]);assert.throws(()=>validateThemeCatalog(list,src),error);}
 const list=clone();list.reverse();assert.throws(()=>validateThemeCatalog(list,src),/start with modern/);
});
test('a new CSS theme needs only a catalog entry; runtime validation has no fixed theme count',()=>{
 const list=clone();list.push({id:'nextTheme',label:'다음 테마',aliases:['nextOldName'],styles:['themes/templates/theme.css']});
 validateThemeCatalog(list,src);const s=runtime(list);assert.equal(s.normalizeManualTheme('nextTheme'),'nextTheme');assert.equal(s.normalizeManualTheme('nextOldName'),'nextTheme');assert.equal(s.normalizeManualTheme('missing'),'modern');
});
test('effect changes dispose the previous effect before refreshing the next; reduced motion and hidden state are delivered',()=>{
 const s=runtime(),events=[];
 for(const id of ['pixel','matrix'])s.registerManualThemeEffect(id,{refresh:context=>events.push([id,'refresh',context.motionEnabled,context.hidden]),dispose:()=>events.push([id,'dispose'])});
 s.document.documentElement.dataset.theme='pixel';s.syncManualThemeEffect();s.syncManualThemeEffect();
 s.document.documentElement.dataset.theme='matrix';s.manualMotionEnabled=()=>false;s.document.hidden=true;s.syncManualThemeEffect();
 s.document.documentElement.dataset.theme='oldAndFaithful';s.syncManualThemeEffect();s.syncManualThemeEffect();
 assert.deepEqual(events,[['pixel','refresh',true,false],['pixel','refresh',true,false],['pixel','dispose'],['matrix','refresh',false,true],['matrix','dispose']]);
});
test('effects require a registered ID and disposal; duplicate registration fails early',()=>{
 const s=runtime(),effect={refresh(){},dispose(){}};
 assert.throws(()=>s.registerManualThemeEffect('unknown',effect),/Invalid/);assert.throws(()=>s.registerManualThemeEffect('matrix',{refresh(){}}),/dispose/);
 s.registerManualThemeEffect('matrix',effect);assert.throws(()=>s.registerManualThemeEffect('matrix',effect),/duplicate/);
});
test('motion lock policy comes from catalog metadata and retains its existing tooltip',()=>{
 const s=runtime();assert.equal(s.getManualThemeDefinition('boringAndCliche').motionLockReason,'관공서 테마에서 애니메이션은 사치입니다.');
 assert.equal(s.getManualThemeDefinition('matrix').motionLockReason,undefined);
});

test('optional header hooks receive opening and closing without owning accordion behavior',()=>{
 const s=runtime(),states=[];let cleared=0;const header={querySelector:()=>({replaceChildren(){cleared++;}})};
 s.registerManualThemeEffect('matrix',{refresh(){},dispose(){},updateHeader:(received,expanded)=>{assert.equal(received,header);states.push(expanded);}});
 s.document.documentElement.dataset.theme='matrix';s.syncManualThemeEffect();
 s.updateAccordionTitleConveyor(header,true);s.updateAccordionTitleConveyor(header,false);
 assert.deepEqual(states,[true,false]);assert.equal(cleared,1);
});
