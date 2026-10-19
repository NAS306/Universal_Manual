const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'../src/js',name),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
function setup(){
 const s={manualData:{menu:[]},document:{addEventListener(){}},closeContextMenusOnOutsidePointer(){},getDefaultReferenceSectionTitle:()=> '참조'};
 vm.createContext(s);vm.runInContext(read('30-markdown-reference.js')+'\n'+read('80-search-render.js')+'\n'+read('95-backup-menu.js'),s);return s;
}
test('dictionary matcher cache updates on renaming/removing terms and does not retain match offsets',()=>{
 const s=setup();const names=['자동차','자동차등록증'];const pattern=s.createDictionaryMatchPattern(names);
 assert.equal(s.createDictionaryMatchPattern([...names]),pattern);
 for(let i=0;i<3;i++) assert.deepEqual(plain(s.getDictionaryMatches('자동차등록증 자동차',pattern)).map(x=>x.name),names.toReversed());
 names[1]='신분증';assert.notEqual(s.createDictionaryMatchPattern(names),pattern);
 assert.deepEqual(plain(s.getDictionaryMatches('신분증',names)).map(x=>x.name),['신분증']);
 assert.equal(s.createDictionaryMatchPattern([]),null);
});
test('reference lookup never normalizes the full manual during rendering',()=>{
 const s=setup();const reference={title:'증명',content:'참조 내용'};s.manualData.menu=[{isReferenceSection:true,children:[reference]}];
 s.ensureSystemSections=()=>{throw Error('Full normalization should not run');};
 assert.equal(s.getReferenceMap().get('증명'),reference);
});
test('normalizing an already flat dictionary preserves its arrays and entry objects',()=>{
 const s=setup();const child={title:'신분증',children:[]};const children=[child];s.manualData.menu=[{isDictionarySection:true,children}];
 s.ensureDictionarySection();assert.equal(s.manualData.menu[0].children,children);assert.equal(children[0],child);
});
test('search reads tables without normalizing or replacing their arrays',()=>{
 const s=setup();s.ensureItemTables=()=>{throw Error('Search must be read-only');};
 const cells=[['검색할 셀']];s.manualData.menu=[{title:'업무',tables:[{cells}]}];
 assert.deepEqual(plain(s.findSearchResults('검색할')),[[0]]);assert.equal(s.manualData.menu[0].tables[0].cells,cells);
});
test('nearest search result retains ties and matches a direct distance calculation',()=>{
 const s=setup();let seed=17;const random=()=>((seed=(seed*16807)%2147483647)/2147483647);
 for(let round=0;round<40;round++){
  const open=Array.from({length:40},(_,i)=>i).filter(()=>random()<.15);
  const results=Array.from({length:12},()=>[Math.floor(random()*40)]);
  const items=Array.from({length:40},(_,i)=>({dataset:{path:String(i)},querySelector:()=>open.includes(i)?{}:null}));
  s.document.querySelectorAll=()=>items;vm.runInContext('manualSearchState.results='+JSON.stringify(results),s);
  const distances=results.map(([i])=>open.length?Math.min(...open.map(j=>Math.abs(i-j))):Infinity);
  const expected=distances.indexOf(Math.min(...distances));assert.equal(s.nearestSearchIndex(),expected);
 }
});
test('selective backup clone preserves custom fields and isolates all nested data from the source',()=>{
 const s=setup();const source={title:'업무',custom:{tags:['보존']},images:[{url:'image'}],children:[{title:'선택',tables:[{cells:[['값']]}],children:[]},{title:'제외',children:[]}]};
 const snapshot=JSON.stringify(source);const result=s.cloneManualItemForImport(source,[0],new Set(['0','0.0']));
 assert.equal(result.children.length,1);assert.deepEqual(plain(result.custom),source.custom);
 result.custom.tags.push('변경');result.children[0].tables[0].cells[0][0]='수정';assert.equal(JSON.stringify(source),snapshot);
 assert.equal(s.cloneManualItemForImport(source,[0],new Set(['0.0'])),null);
});
test('backup merging keeps overwrite, new-only and import-all semantics with independent data',()=>{
 const s=setup();const source={title:'업무',content:'새 본문',custom:{x:1},children:[{title:'기존하위',content:'새 하위',children:[]},{title:'신규하위',content:'추가',children:[]}]};
 for(const mode of ['overwrite','newOnly','importAll']){
  const items=[{title:'업무',content:'기존 본문',children:[{title:'기존하위',content:'기존 하위',children:[]}]}];
  const snapshot=JSON.stringify(source);s.mergeImportedItem(items,source,mode);
  assert.equal(items.length,mode==='importAll'?2:1);
  if(mode==='importAll') assert.equal(items[1].content,'새 본문');
  else {assert.equal(items[0].content,mode==='overwrite'?'새 본문':'기존 본문');assert.equal(items[0].children[0].content,mode==='overwrite'?'새 하위':'기존 하위');assert.equal(items[0].children[1].title,'신규하위');}
  const changed=mode==='importAll'?items[1]:items[0];if(changed.custom)changed.custom.x=9;assert.equal(JSON.stringify(source),snapshot);
 }
});
