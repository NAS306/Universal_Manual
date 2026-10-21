const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'../src/js',name),'utf8');
const data=JSON.parse(read('10-data-state.js').match(/const DEFAULT_DATA =\s*([\s\S]*?);\s*function cloneDefaultDataValue/)[1]);
const fixture=name=>JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures',name),'utf8'));
const legacy=fixture('legacy-default-guide.json'),previous=fixture('previous-default-guide.json'),expanded=fixture('expanded-default-examples.json'),compact=fixture('compact-default-guide.json'),preMatrix=fixture('pre-matrix-default-guide.json');
const preKeywords=fixture('pre-keywords-default-guide.json');
const preDiff=fixture('pre-diff-default-guide.json');
const clone=value=>JSON.parse(JSON.stringify(value));
function setup(item,extra=[]){const s={DEFAULT_DATA:data,manualData:{menu:[item,...extra]},cloneDefaultDataValue:clone};vm.createContext(s);vm.runInContext(read('28-default-guide.js'),s);return s;}

test('the guide has a short start, a hierarchical hands-on example and current feature instructions',()=>{
 const guide=data.menu.find(x=>x.isDescriptionSection);assert(guide);assert(guide.content.length<800);assert.equal(guide.children.length,7);
 const text=JSON.stringify(guide);for(const word of ['Tab','50단계','90%','oldAndFaithful','boringAndCliche','matrix','3분할','겹치기 (왼쪽)','선택 항목 불러오기'])assert(text.includes(word),word);
 assert.equal(guide.children[2].children.length,2);assert(guide.children.flatMap(x=>x.tables).length>=3);
 assert(!text.includes('data:image'));assert(!text.includes('2026년 07월 13일'));
 const mapping=guide.children[0].tables[0].cells;for(const title of ['전역 매뉴얼','본문 아코디언','사전','참조'])assert(mapping.some(row=>row[0]===title));
});

test('default examples have defined references, real dictionary terms and a shared global/body source',()=>{
 const ref=data.menu.find(x=>x.isReferenceSection),dict=data.menu.find(x=>x.isDictionarySection),guide=data.menu.find(x=>x.isDescriptionSection);
 const names=new Set(ref.children.map(x=>x.title));
 for(const match of JSON.stringify(data).matchAll(/\{\{([^{}]+)\}\}/g))assert(names.has(match[1]),match[1]);
 assert(dict.children.some(x=>x.title==='사전에 정의된 용어'));assert(guide.content.includes('사전에 정의된 용어'));
 assert(dict.children.every(x=>x.children.length===0));assert.equal(data.globalManual,data.globalTabs[0].content);
 assert(data.globalTabs[0].content.includes('{{예제_공통확인}}'));
 for(const child of guide.children[2].children)assert(child.content.includes('{{예제_공통확인}}'));
 assert(ref.children.find(x=>x.title==='예제_확인표').tables.length>0);
 assert(!JSON.stringify(data).includes('https://')); // No network-dependent sample images.
});

test('unchanged old and previous guides upgrade in place, install dependencies and remain idempotent',()=>{
 for(const fixture of [legacy,previous,expanded.menu.find(x=>x.isDescriptionSection),compact,preMatrix,preKeywords,preDiff]){
  const item=clone(fixture);item.customMetadata={keep:true};const s=setup(item);s.ensureDefaultDescriptionGuide();
  assert.equal(s.manualData.menu[0],item);assert.equal(item.title,'◉ 매뉴얼 사용 안내');assert.equal(item.children.length,7);assert.equal(item.customMetadata.keep,true);
  assert(s.manualData.menu.some(x=>x.isDictionarySection));assert(s.manualData.menu.some(x=>x.isReferenceSection));
  const after=JSON.stringify(s.manualData);s.ensureDefaultDescriptionGuide();assert.equal(JSON.stringify(s.manualData),after);
 }
});

test('customized guide text, title, tables, images and children survive without injecting examples',()=>{
 for(const fixture of [legacy,previous,expanded.menu.find(x=>x.isDescriptionSection),compact,preMatrix,preKeywords,preDiff])for(const change of [x=>x.content+=' 사용자 메모',x=>x.title='우리 매뉴얼',x=>x.tables=[{cells:[['사용자 표']]}],x=>x.images=[{url:'custom-image'}],x=>x.children.push({title:'사용자 하위 안내'})]){
  const item=clone(fixture);change(item);const before=JSON.stringify(item),s=setup(item);s.ensureDefaultDescriptionGuide();assert.equal(JSON.stringify(item),before);assert.equal(s.manualData.menu.length,1);
 }
});

test('only a pristine legacy reference demo is replaced; custom sources and name collisions are preserved',()=>{
 const oldRef=fixture('legacy-default-reference.json'),s=setup(clone(previous),[oldRef]);s.ensureDefaultDescriptionGuide();
 assert.equal(s.manualData.menu[1],oldRef);assert(!JSON.stringify(oldRef).includes('https://'));assert.equal(oldRef.children.length,2);
 const own=fixture('legacy-default-reference.json');own.children[0].content+=' 사용자 내용';const original=JSON.stringify(own.children[0]);
 own.children.push({title:'예제_공통확인',content:'사용자 원본',tables:[],images:[],children:[]});
 const dict={title:'사전',isDictionarySection:true,children:[{title:'사전에 정의된 용어',content:'사용자 해설',children:[]}]};
 const t=setup(clone(previous),[own,dict]);t.ensureDefaultDescriptionGuide();
 assert.equal(JSON.stringify(own.children[0]),original);assert.equal(own.children.filter(x=>x.title==='예제_공통확인').length,1);
 assert.equal(own.children.find(x=>x.title==='예제_공통확인').content,'사용자 원본');assert.equal(dict.children[0].content,'사용자 해설');
});

test('global placeholder migration preserves real content and avoids unresolved examples in custom manuals',()=>{
 const s={DEFAULT_DATA:data,manualData:clone(data)};vm.createContext(s);vm.runInContext(read('20-storage.js'),s);
 assert.equal(s.normalizeGlobalTabContent('이곳은 전역 메뉴얼 자리입니다.'),data.globalManual);
 assert.equal(s.normalizeGlobalTabContent('직접 작성한 전역 안내'),'직접 작성한 전역 안내');
 s.manualData={menu:[]};assert.equal(s.normalizeGlobalTabContent('이곳은 전역 메뉴얼 자리입니다.'),'이곳은 전역 메뉴얼 자리입니다.');
 const legacyHelp='이곳은 전역 메뉴얼 자리입니다.\n텍스트만 입력 가능하며, 이미지/표/참조는 불가능합니다.\n\n\n';
 assert(!s.normalizeGlobalTabContent(legacyHelp).includes('{{'));
});

test('edit mode renders only an atomic reference variable and retains the original stored token',()=>{
 const s={document:{addEventListener(){},createElement(){return {dataset:{},innerHTML:''};}},renderReferenceHtml(){throw new Error('Expanded reference content must not render in edit mode');}};
 vm.createContext(s);vm.runInContext(read('60-accordion-core.js'),s);
 const token='{{ 예제_확인표 }}',node=s.createEditableReferenceToken(token,' 예제_확인표 ');
 assert.equal(node.textContent,token);assert.equal(node.innerHTML,'');assert.equal(node.contentEditable,'false');
 assert.equal(node.dataset.referenceToken,token);assert.equal(node.dataset.referenceName,'예제_확인표');
});

test('multiple imported roots keep dictionary collisions and provide references in the active first root',()=>{
 const active={title:'참조',isReferenceSection:true,content:'사용자 원본 모음',children:[]};
 const extra={title:'참조',isReferenceSection:true,content:'추가 참조',children:[{title:'예제_공통확인',content:'추가 루트의 사용자 원본'}]};
 const firstDict={title:'사전',isDictionarySection:true,children:[]};
 const extraDict={title:'사전',isDictionarySection:true,children:[{title:'사전에 정의된 용어',content:'추가 사전의 해설'}]};
 const before=JSON.stringify([extra,extraDict]),s=setup(clone(previous),[active,extra,firstDict,extraDict]);s.ensureDefaultDescriptionGuide();
 assert(active.children.some(x=>x.title==='예제_공통확인'));assert.equal(JSON.stringify([extra,extraDict]),before);
 assert(!firstDict.children.some(x=>x.title==='사전에 정의된 용어'));
});

test('reference explanations show their examples immediately in the same text block',()=>{
 const guide=data.menu.find(x=>x.isDescriptionSection),explanation=guide.children.find(x=>x.title.startsWith('4.'));
 assert(explanation.content.indexOf('{{예제_공통확인}}')<80);
 assert.equal((explanation.content.match(/\{\{예제_공통확인\}\}/g)||[]).length,2);
 assert(explanation.content.length<650);assert.equal(explanation.children.length,0);assert.equal(explanation.tables.length,0);
 assert(!JSON.stringify(guide).includes('markdown'));assert(!guide.children.some(x=>x.title.startsWith('0.')));
});
test('unchanged expanded example sources are shortened together with their guide',()=>{
 const s=setup(clone(expanded.menu.find(x=>x.isDescriptionSection)),clone(expanded.menu.filter(x=>!x.isDescriptionSection)));s.ensureDefaultDescriptionGuide();
 for(const flag of ['isReferenceSection','isDictionarySection'])assert.equal(JSON.stringify(s.manualData.menu.find(x=>x[flag])),JSON.stringify(data.menu.find(x=>x[flag])));
});

test('dictionary instructions explain shared keywords and preserve aliased user examples',()=>{
 const guide=data.menu.find(x=>x.isDescriptionSection);assert(guide.children[1].content.includes('매도용 인감증명서&매도용 법인인감증명서'));
 const own={title:'사전',isDictionarySection:true,children:[{title:'별칭&사전에 정의된 용어',content:'사용자 해설'}]};
 const before=JSON.stringify(own.children[0]),s=setup(clone(preKeywords),[own]);s.ensureDefaultDescriptionGuide();
 assert.equal(JSON.stringify(own.children[0]),before);assert(!own.children.some(x=>x.title==='사전에 정의된 용어'));
});
