const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function setup(){const s={getActiveAccordionRoot:()=>s.document.getElementById("main-accordion")};vm.createContext(s);vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/js/58-accordion-scroll.js'),'utf8'),s);return s;}
test('virtual tail supplies only missing space to place the final header at the viewport top',()=>{
 const s=setup();assert.equal(s.getAccordionAlignmentSpace(900,600,1000),500);assert.equal(s.getAccordionAlignmentSpace(100,600,2000),0);assert.equal(s.getAccordionAlignmentSpace(200,600,800),0);
});
test('mode restoration uses content progress inside a block and preserves gaps above a block',()=>{
 const s=setup();assert.equal(s.getRestoredAccordionTop(1000,800,{progress:.25,offset:-100}),1200);assert.equal(s.getRestoredAccordionTop(1000,800,{progress:null,offset:20}),980);
});

test('enabled alignment is synchronous and settles other height animations while preserving its own expansion',()=>{
 const s=setup();const own={classList:{contains:()=>true}},other={classList:{contains:()=>true}};let ownFinished=false,otherFinished=false,space=false,result=null;
 const header={isConnected:true,nextElementSibling:own,getBoundingClientRect:()=>({top:500})};
 s.document={getElementById:()=>({getAnimations:()=>[{effect:{target:own},finish(){ownFinished=true;}},{effect:{target:other},finish(){otherFinished=true;}}]})};
 s.updateAccordionScrollSpace=()=>{space=true;};s.getAccordionScroller=()=>({scrollTop:100,scrollTo:value=>{result=value;}});s.getAccordionViewportTop=()=>200;
 vm.runInContext('accordionHeaderAlignmentEnabled=true',s);s.requestAccordionHeaderAlignment(header);
 assert.equal(otherFinished,true);assert.equal(ownFinished,false);assert.equal(space,true);assert.equal(result.top,400);assert.equal(result.behavior,'instant');
});

test('search layout waiting ignores infinite conveyor animations',async()=>{
 const s=setup();let called=false;s.requestAnimationFrame=callback=>callback();
 s.document={getElementById:()=>({getAnimations:()=>[
  {effect:{getComputedTiming:()=>({endTime:Infinity})},finished:new Promise(()=>{})},
  {effect:{getComputedTiming:()=>({endTime:220})},finished:Promise.resolve()}
 ]})};s.waitForAccordionLayout(()=>{called=true;});await new Promise(resolve=>setImmediate(resolve));assert.equal(called,true);
});
