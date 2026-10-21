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
