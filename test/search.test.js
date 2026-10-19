const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function setup(){
 const s={manualData:{menu:[
  {title:'참조',isReferenceSection:true,content:'참조루트전용설명',children:[
   {title:'내부참조명',content:'불러온 전용 문장',tables:[{cells:[['공통서류표']]}],children:[{title:'깊은참조',content:'깊은원본설명'}]},
   {title:'사용안한원본제목',content:'사용안한원본본문',tables:[{cells:[['사용안한원본표']]}]},
   {title:'중첩원본명',content:'{{내부참조명}} 추가 안내'}
  ]},
  {title:'사전',isDictionarySection:true,children:[{title:'신분증',content:'사전전용설명',tables:[{cells:[['사전표']]}]}]},
  {title:'업무',content:'신분증을 확인합니다. {{내부참조명}}',tables:[{cells:[['직접작성표 {{내부참조명}}']]}],children:[{title:'하위업무',content:'CaseSensitive'}]},
  {title:'다른업무',content:'{{중첩원본명}}'}
 ]},isReferenceSection:item=>item.isReferenceSection===true||item.title==='참조',isDictionarySection:item=>item.isDictionarySection===true,
 ensureItemTables:()=>{throw Error('Search must not normalize tables');}};
 s.getReferenceMap=()=>new Map((s.manualData.menu.find(s.isReferenceSection)?.children||[]).map(x=>[x.title.trim(),x]));
 vm.createContext(s);vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/js/80-search-render.js'),'utf8'),s);return s;
}
const results=(s,q)=>JSON.parse(JSON.stringify(s.findSearchResults(q)));

test('source roots, unused source content and dictionary explanations are excluded',()=>{
 const s=setup();for(const query of ['참조루트전용설명','사용안한원본제목','사용안한원본본문','사용안한원본표','사전전용설명','사전표','깊은원본설명']) assert.deepEqual(results(s,query),[]);
});
test('normal text and table cells remain searchable with original item paths',()=>{
 const s=setup();assert.deepEqual(results(s,'신분증'),[[2]]);assert.deepEqual(results(s,'직접작성표'),[[2]]);assert.deepEqual(results(s,'casesensitive'),[[2,0]]);
});
test('reference body and table text find the consuming ordinary items once, including nested references',()=>{
 const s=setup();for(const query of ['불러온 전용 문장','공통서류표'])assert.deepEqual(results(s,query),[[2],[3]]);
 assert.deepEqual(results(s,'추가 안내'),[[3]]);
});
test('reference names do not produce hits while adjacent body text remains searchable',()=>{
 const s=setup();assert.deepEqual(results(s,'내부참조명'),[]);assert.deepEqual(results(s,'중첩원본명'),[]);assert.deepEqual(results(s,'확인합니다'),[[2]]);assert.deepEqual(results(s,'   '),[]);
});
test('missing and circular references terminate without matching variable names or mutating data',()=>{
 const s=setup();s.manualData.menu[0].children.push({title:'순환A',content:'순환상세 {{순환B}}'},{title:'순환B',content:'{{순환A}}'});
 s.manualData.menu[2].content='{{순환A}} {{없는원본}}';const before=JSON.stringify(s.manualData);
 assert.deepEqual(results(s,'순환상세'),[[2]]);assert.deepEqual(results(s,'없는원본'),[]);assert.deepEqual(results(s,'순환B'),[]);assert.equal(JSON.stringify(s.manualData),before);
});
test('source edits are reflected on the next search and references are read without normalizing tables',()=>{
 const s=setup(),source=s.manualData.menu[0].children[0],cells=source.tables[0].cells;
 assert.deepEqual(results(s,'불러온 전용 문장'),[[2],[3]]);source.content='변경된 설명';
 assert.deepEqual(results(s,'불러온 전용 문장'),[]);assert.deepEqual(results(s,'변경된 설명'),[[2],[3]]);assert.equal(source.tables[0].cells,cells);
});
test('a manual without source roots is searched without creating a root or looking up references',()=>{
 const s=setup();s.manualData.menu=[{title:'기존업무',content:'기존문장 {{누락}}'}];s.getReferenceMap=()=>{throw Error('Must not create a missing root');};const before=JSON.stringify(s.manualData);
 assert.deepEqual(results(s,'기존문장'),[[0]]);assert.equal(JSON.stringify(s.manualData),before);
});
