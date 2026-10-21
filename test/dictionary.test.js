const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'../src/js',name),'utf8');
function setup(){
 const sandbox={window:{addEventListener(){}},manualData:{menu:[]},getDefaultReferenceSectionTitle:()=> '참조'};
 vm.createContext(sandbox);
 vm.runInContext(read('28-default-guide.js')+'\n'+read('30-markdown-reference.js')+'\n'+read('56-dictionary.js'),sandbox);
 return sandbox;
}
test('legacy manual gains an empty dictionary without replacing existing content',()=>{
 const s=setup(); const original={title:'업무',content:'기존 본문',children:[]};
 s.manualData={globalManual:'이전 전역 매뉴얼',menu:[original]};
 s.ensureDictionarySection();s.ensureDictionarySection();
 assert.equal(s.manualData.menu.length,2);
 assert.equal(s.manualData.menu[0],original);
 assert.equal(s.manualData.globalManual,'이전 전역 매뉴얼');
 assert.equal(s.getDictionaryEntries().size,0);
});
test('matching prefers the longest term and handles repeated terms and Korean particles',()=>{
 const s=setup();
 const matches=s.getDictionaryMatches('자동차등록증과 자동차, 자동차등록증을',['자동차','자동차등록증']);
 assert.deepEqual(Array.from(matches,x=>x.name),['자동차등록증','자동차','자동차등록증']);
 assert.equal(matches[0].start,0);
});
test('term punctuation is literal rather than a regular expression',()=>{
 const s=setup();
 const matches=s.getDictionaryMatches('A+B (등록) AAB',['A+B','(등록)']);
 assert.deepEqual(Array.from(matches,x=>x.name),['A+B','(등록)']);
});
test('legacy nested terms are flattened without losing content; repeated normalization is stable',()=>{
 const s=setup();s.ensureDictionarySection();
 s.manualData.menu[0].children=[{title:'등록',content:'첫 설명',children:[{title:'원본',content:'하위 설명'}]},{title:'등록',content:'두 번째'}];
 s.manualData=JSON.parse(JSON.stringify(s.manualData));
 s.ensureDictionarySection();
 const entries = s.manualData.menu[0].children;
 assert.deepEqual(Array.from(entries,x=>x.title),['등록','원본','등록']);
 assert.ok(entries.every(x=>x.children.length===0));
 s.ensureDictionarySection();
 assert.equal(s.manualData.menu[0].children.length,3);
 assert.equal(s.getDictionaryEntries().get('등록').content,'첫 설명');
 assert.equal(s.getDictionaryEntries().get('원본').content,'하위 설명');
});
test('completion finds prefix candidates and replaces only the active word',()=>{
 const s=setup();const match=s.getDictionaryCompletion('필요 서류: 자동',9,['자동차등록증','자동차','등록증']);
 assert.deepEqual(Array.from(match.candidates),['자동차','자동차등록증']);
 assert.equal(match.start,7);assert.equal(match.end,9);
 assert.equal(s.getDictionaryCompletion('자동차등록증',6,['자동차등록증']),null);
 assert.equal(s.getDictionaryCompletion('자동 ',3,['자동차등록증']),null);
});

test('adding a child below a dictionary term stops before prompting or changing data',()=>{
 const s=setup();s.ensureDictionarySection();
 s.manualData.menu[0].children=[{title:'등록',content:'설명',children:[]}];
 s.prompt=()=>{throw new Error('Should not prompt');};
 s.alert=()=>{};
 vm.runInContext(read('90-editing.js'),s);
 s.addItemAtLevel([0,0]);
 assert.equal(s.manualData.menu[0].children[0].children.length,0);
});
test('dragging into a dictionary term does not remove the source item',()=>{
 const s=setup();s.ensureDictionarySection();
 s.manualData.menu[0].children=[{title:'등록',content:'설명',children:[]}];
 const moved={title:'다른 용어',content:'이동할 설명',children:[]};
 s.manualData.menu.push(moved);
 s.document={addEventListener(){}};
 s.dragState={element:{contains(){return false;}}};
 s.getItemByPath=p=>p.length===1?s.manualData.menu[p[0]]:s.manualData.menu[p[0]].children[p[1]];
 vm.runInContext(read('60-accordion-core.js'),s);
 s.moveItemToDropTarget([1],{element:{dataset:{path:'0.0'}},mode:'inside'});
 assert.equal(s.manualData.menu[1],moved);
 assert.equal(s.manualData.menu[0].children[0].children.length,0);
});

test('dictionary layout modes preserve both overlays and reject unknown stored values',()=>{
 const s=setup();
 for(const mode of ['push','compress','overlay-left','overlay-right']) assert.equal(s.normalizeDictionaryMode(mode),mode);
 for(const mode of [null,'','invalid','__proto__']) assert.equal(s.normalizeDictionaryMode(mode),'push');
 assert.equal(s.isDictionaryOverlay('overlay-left'),true);
 assert.equal(s.isDictionaryOverlay('overlay-right'),true);
 assert.equal(s.isDictionaryOverlay('push'),false);
 assert.equal(s.isDictionaryOverlay('compress'),false);
});

test('overlay ratio is constrained to viewport percentages and handles absent settings',()=>{
 const s=setup();vm.runInContext(read('57-dictionary-resizer.js'),s);
 for(const value of [null,'','invalid',undefined]) assert.equal(s.clampDictionaryOverlayRatio(value),50);
 assert.equal(s.clampDictionaryOverlayRatio(0),20);assert.equal(s.clampDictionaryOverlayRatio(19),20);
 assert.equal(s.clampDictionaryOverlayRatio(81),80);assert.equal(s.clampDictionaryOverlayRatio(120),80);
 assert.equal(s.clampDictionaryOverlayRatio('63.5'),63.5);
});

test('IME composition shows prefix suggestions even while its syllable is selected',()=>{
 const s=setup();
 const editor={dataset:{imeComposing:'true'},contains:()=>true};
 s.currentMode='edit';
 s.document={getElementById(){return null;}};
 s.window.getSelection=()=>({rangeCount:1,isCollapsed:false,getRangeAt:()=>({endContainer:{}})});
 s.getEditableText=()=> '신분';s.getCaretTextOffset=()=>2;
 s.getReferenceAutocompleteMatch=()=>null;
 s.getDictionaryEntries=()=>new Map([['신분증',{}]]);
 let displayed=false;s.renderDictionaryAutocomplete=()=>{displayed=true;};
 s.updateDictionaryAutocomplete(editor);
 assert.equal(displayed,true);
 assert.deepEqual(Array.from(vm.runInContext('dictionaryAutocomplete.candidates',s)),['신분증']);
 assert.equal(editor.dataset.imeComposing,'true');
});
test('system roots stay at the bottom without changing ordinary order, data or object identity',()=>{
 const s=setup(),a={title:'업무 A',content:'본문',children:[{title:'하위'}]},b={title:'업무 B',custom:{keep:true}},r={title:'참조',isReferenceSection:true,children:[{title:'증명',content:'원본'}]},r2={title:'추가 참조',isReferenceSection:true},d={title:'사전',isDictionarySection:true,children:[{title:'신분증',content:'상세 설명'}]},d2={title:'추가 사전',isDictionarySection:true};
 const menu=[r,a,d,b,r2,d2];s.manualData.menu=menu;
 const content=new Map(menu.map(item=>[item,JSON.stringify(item)]));
 s.ensureSystemSectionOrder();assert.equal(s.manualData.menu,menu);assert.deepEqual(Array.from(menu),[a,b,r,r2,d,d2]);
 for(const item of menu)assert.equal(JSON.stringify(item),content.get(item));
 const after=JSON.stringify(menu);s.ensureSystemSectionOrder();assert.equal(JSON.stringify(menu),after);
 const added={title:'새 업무'};menu.push(added);s.ensureSystemSectionOrder();assert.deepEqual(Array.from(menu),[a,b,added,r,r2,d,d2]);
});

test('legacy normalization appends a missing reference, orders system roots and never marks a dictionary as the description',()=>{
 const s=setup(),ordinary={title:'업무',content:'내용',children:[]},dictionary={title:'사전',isDictionarySection:true,children:[]};
 s.getDefaultReferenceSection=()=>({title:'참조',content:'기본 참조',tables:[],images:[]});
 s.cloneDefaultReferenceSection=()=>({title:'참조',content:'기본 참조',isReferenceSection:true,tables:[],images:[],children:[]});
 s.normalizeImageList=value=>value||[];s.normalizeAllImages=()=>{};
 s.manualData={menu:[dictionary,ordinary]};s.ensureSystemSections();
 const menu=s.manualData.menu;assert.equal(menu[0],ordinary);assert.equal(menu[1].isReferenceSection,true);assert.equal(menu[2],dictionary);
 assert.equal(ordinary.isDescriptionSection,true);assert.notEqual(dictionary.isDescriptionSection,true);
 const before=JSON.stringify(menu);s.ensureSystemSections();assert.equal(JSON.stringify(menu),before);
 s.ensureReferenceSection();assert.equal(menu[0],ordinary);assert.equal(menu[1].isReferenceSection,true);
});


test('ampersand keywords share an entry without changing stored data and complete separately',()=>{
 const s=setup(),entry={title:' 매도용 인감증명서 & 매도용 법인인감증명서 && 매도용 인감증명서 ',content:'공통 설명',tables:[{cells:[['공통 표']]}],images:[{url:'local'}],children:[]};
 s.manualData.menu=[{isDictionarySection:true,children:[entry]}];const before=JSON.stringify(s.manualData),entries=s.getDictionaryEntries();
 assert.deepEqual(Array.from(entries.keys()),['매도용 인감증명서','매도용 법인인감증명서']);
 for(const keyword of entries.keys())assert.equal(entries.get(keyword),entry);
 assert.equal(JSON.stringify(s.manualData),before);
 const match=s.getDictionaryCompletion('매도',2,entries.keys());assert.equal(match.candidates.length,2);
 assert(match.candidates.every(name=>!name.includes('&')));
 assert.deepEqual(Array.from(s.getDictionaryMatches('매도용 인감증명서와 매도용 법인인감증명서',entries.keys()),x=>x.name),Array.from(entries.keys()));
});

test('alias collisions in imported dictionaries keep first-entry precedence without discarding other keywords',()=>{
 const s=setup(),a={title:'공통&첫 용어'},b={title:'다른 용어&공통'},c={title:'공통&마지막'};
 s.manualData.menu=[{isDictionarySection:true,children:[a,b]},{isDictionarySection:true,children:[c]}];
 const entries=s.getDictionaryEntries();assert.equal(entries.get('공통'),a);assert.equal(entries.get('다른 용어'),b);assert.equal(entries.get('마지막'),c);
 assert.equal(s.getDictionaryEntries(a).get('공통'),b);
 assert.deepEqual(Array.from(s.getDictionaryKeywords(' & && ')),[]);
 assert.deepEqual(Array.from(s.getDictionaryKeywords('A+B & (등록)&A+B')),['A+B','(등록)']);
});

function setupDictionaryEditing(){
 const s=setup();s.manualData.menu=[{isDictionarySection:true,children:[{title:'신분증&본인 확인',children:[]},{title:'등록증&차량 확인',children:[]}]}];
 s.messages=[];s.alert=message=>s.messages.push(message);s.saved=0;s.saveAndRender=()=>s.saved++;
 s.getItemByPath=parts=>parts.length===1?s.manualData.menu[parts[0]]:s.manualData.menu[parts[0]].children[parts[1]];
 s.getItemsArrayByPath=parts=>parts.length?s.getItemByPath(parts).children:s.manualData.menu;
 s.getOpenItemRefs=()=>[];s.createEmptyItem=title=>({title,content:'',children:[]});s.renderAccordion=()=>{};
 vm.runInContext(read('90-editing.js'),s);return s;
}

test('adding entries rejects any existing keyword or delimiter-only title and accepts distinct keywords',()=>{
 const s=setupDictionaryEditing();
 for(const title of ['새 용어&신분증',' & && ']){s.prompt=()=>title;s.addItemAtLevel([0]);}
 assert.equal(s.manualData.menu[0].children.length,2);assert.equal(s.saved,0);assert.equal(s.messages.length,2);
 s.prompt=()=> '매도용 인감증명서&매도용 법인인감증명서';s.addItemAtLevel([0]);
 assert.equal(s.saved,1);assert.equal(s.manualData.menu[0].children.length,3);
 assert.equal(s.getDictionaryEntries().get('매도용 인감증명서'),s.getDictionaryEntries().get('매도용 법인인감증명서'));
});

test('renaming permits own aliases but rejects other entries including hidden legacy collisions',()=>{
 const s=setupDictionaryEditing(),entry=s.manualData.menu[0].children[0];
 s.prompt=()=> '신분증&신원 확인';s.editItemTitle([0,0]);assert.equal(s.saved,1);assert.equal(s.getDictionaryEntries().get('신원 확인'),entry);assert(!s.getDictionaryEntries().has('본인 확인'));
 for(const title of ['신분증&등록증','&&']){s.prompt=()=>title;s.editItemTitle([0,0]);}assert.equal(s.saved,1);assert.equal(entry.title,'신분증&신원 확인');
 s.manualData.menu.push({isDictionarySection:true,children:[{title:'숨은 별칭&신분증'}]});
 s.prompt=()=> '신분증&다른 이름';s.editItemTitle([0,0]);assert.equal(s.saved,1);assert.equal(entry.title,'신분증&신원 확인');
 s.prompt=()=> '독립 용어&다른 이름';s.editItemTitle([0,0]);assert.equal(s.saved,2);assert(!s.getDictionaryEntries().has('신원 확인'));
});


test('dragging an entry into the dictionary checks each keyword before removing it',()=>{
 const s=setupDictionaryEditing(),moved={title:'추가 용어&신분증',children:[]};s.manualData.menu.push(moved);
 s.document={addEventListener(){}};s.dragState={element:{contains(){return false;}}};
 vm.runInContext(read('60-accordion-core.js'),s);
 s.moveItemToDropTarget([1],{element:{dataset:{path:'0'}},mode:'inside'});
 assert.equal(s.manualData.menu[1],moved);assert.equal(s.manualData.menu[0].children.length,2);assert.equal(s.saved,0);assert.equal(s.messages.length,1);
});
