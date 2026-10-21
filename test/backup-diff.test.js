const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'../src/js',name),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
const item=(title,content='',children=[])=>({title,content,children,tables:[],images:[]});
function setup(){const s={document:{addEventListener(){}},DEFAULT_GLOBAL_TAB_TITLE:'전역 메뉴얼',getDefaultReferenceSectionTitle:()=> '참조'};vm.createContext(s);vm.runInContext(['30-markdown-reference.js','60-accordion-core.js','93-backup-diff.js'].map(read).join('\n'),s);return s;}
function merge(s,a,b,predicate,mode='overwrite'){const records=s.buildBackupComparison(a,b),selected=new Set(records.filter(predicate).map(x=>x.id));return s.mergeBackupComparison(a,b,records,selected,mode).data;}

test('comparison classifies per-item changes without treating child changes as parent changes',()=>{
 const s=setup(),a={menu:[item('업무','부모',[item('하위','이전'),item('현재만')]),item('동일')]},b={menu:[item('업무','부모',[item('하위','이후'),item('신규')]),item('동일')]};
 const before=JSON.stringify([a,b]),records=s.buildBackupComparison(a,b);
 assert.equal(records.find(x=>x.id==='menu:0').status,'same');assert.equal(records.find(x=>x.id==='menu:0.0').status,'changed');
 assert.equal(records.find(x=>x.id==='menu:0.1').status,'added');assert.equal(records.find(x=>x.id==='current-menu:0.1').status,'currentOnly');
 assert.equal(JSON.stringify([a,b]),before);
});
test('selecting only a child preserves parent content, current-only children, other roots and custom fields',()=>{
 const s=setup(),a={manualName:'현재',custom:{keep:true},menu:[{...item('업무','보존할 부모',[item('하위','이전'),item('현재만','보존')]),custom:{tags:['보존']}},item('다른 업무','보존')]},b={manualName:'다른 이름',menu:[item('업무','덮으면 안됨',[item('하위','새 본문'),item('선택안함')])]};
 const snapshots=JSON.stringify([a,b]),result=merge(s,a,b,x=>x.id==='menu:0.0');
 assert.equal(result.menu[0].content,'보존할 부모');assert.equal(result.menu[0].children[0].content,'새 본문');assert.equal(result.menu[0].children[1].content,'보존');assert.equal(result.menu[0].children.length,2);
 assert.equal(result.manualName,'현재');assert.deepEqual(plain(result.custom),a.custom);assert.deepEqual(plain(result.menu[0].custom),a.menu[0].custom);assert.equal(result.menu[1].content,'보존');
 result.menu[0].custom.tags.push('독립');assert.equal(JSON.stringify([a,b]),snapshots);
});
test('a missing parent is created for a selected descendant without importing its unselected siblings',()=>{
 const s=setup(),a={menu:[]},b={menu:[item('새 부모','부모 안내',[item('선택','본문'),item('제외')])]};
 const result=merge(s,a,b,x=>x.id==='menu:0.0');assert.equal(result.menu[0].content,'부모 안내');assert.deepEqual(Array.from(result.menu[0].children,x=>x.title),['선택']);
});
test('selecting a parent payload does not replace or implicitly import its children',()=>{
 const s=setup(),a={menu:[item('업무','전',[item('기존','보존')])]},b={menu:[item('업무','후',[item('신규','미선택')])]};
 const result=merge(s,a,b,x=>x.id==='menu:0');assert.equal(result.menu[0].content,'후');assert.deepEqual(Array.from(result.menu[0].children,x=>x.title),['기존']);
});
test('legacy missing fields clear selected payloads but retain unrelated metadata',()=>{
 const s=setup(),a={menu:[{...item('업무','이전'),custom:{keep:1}}]},b={menu:[{title:'업무'}]};
 const result=merge(s,a,b,()=>true);assert.equal(result.menu[0].content,'');assert.deepEqual(plain(result.menu[0].tables),[]);assert.deepEqual(plain(result.menu[0].custom),{keep:1});
});
test('renames and moves remain added plus current-only, never inferred as deletion',()=>{
 const s=setup(),a={menu:[item('기존 이름','내용'),item('부모','',[item('옮길 항목','내용')])]},b={menu:[item('새 이름','내용'),item('옮길 항목','내용')]};
 const records=s.buildBackupComparison(a,b);assert.equal(records.filter(x=>x.status==='added').length,2);assert.equal(records.filter(x=>x.status==='currentOnly').length,3);
 const result=merge(s,a,b,()=>true);assert(result.menu.some(x=>x.title==='기존 이름'));assert(result.menu.some(x=>x.title==='부모'));assert(result.menu.some(x=>x.title==='새 이름'));
});
test('duplicate sibling names are ambiguous including their descendants and never overwritten automatically',()=>{
 const s=setup(),a={menu:[item('중복','A',[item('하위','A')]),item('중복','B',[item('하위','B')])]},b={menu:[item('중복','새 내용',[item('하위','새 하위')])]};
 const records=s.buildBackupComparison(a,b);assert(records.filter(x=>x.incoming).every(x=>x.status==='ambiguous'));
 assert.equal(s.mergeBackupComparison(a,b,records,new Set(records.map(x=>x.id)),'overwrite').applied,0);
 const result=merge(s,a,b,x=>x.id==='menu:0.0','importAll');assert.equal(result.menu.length,3);assert.equal(result.menu[2].children[0].content,'새 하위');assert.equal(result.menu[0].content,'A');
});
test('duplicate names in the incoming file are not merged into a unique current entry',()=>{
 const s=setup(),a={menu:[item('같은 제목','원본')]},b={menu:[item('같은 제목','첫째'),item('같은 제목','둘째')]};
 const records=s.buildBackupComparison(a,b);assert(records.filter(x=>x.incoming).every(x=>x.status==='ambiguous'));assert.equal(new Set(records.map(x=>x.id)).size,records.length);
 assert.equal(s.mergeBackupComparison(a,b,records,new Set(records.map(x=>x.id))).applied,0);
});
test('system roots compare by their role; references and dictionary entries are included',()=>{
 const s=setup(),a={menu:[{...item('참조','',[item('원본','전')]),isReferenceSection:true},{...item('사전','',[item('A&B','전')]),isDictionarySection:true}]},b=plain(a);
 b.menu[0].children[0].content='후';b.menu[1].children[0].content='후';
 assert.equal(s.buildBackupComparison(a,b).filter(x=>x.status==='changed').length,2);
 b.menu[1].isDictionarySection=false;assert.equal(s.buildBackupComparison(a,b).find(x=>x.id==='menu:1').status,'added');
});
test('new-only adds selected descendants without overwriting existing ancestors or payloads',()=>{
 const s=setup(),a={menu:[item('업무','보존',[item('기존','보존')])]},b={menu:[item('업무','변경',[item('기존','변경'),item('신규','추가')])]};
 const result=merge(s,a,b,()=>true,'newOnly');assert.equal(result.menu[0].content,'보존');assert.equal(result.menu[0].children[0].content,'보존');assert.equal(result.menu[0].children[1].content,'추가');
});
test('import-all copies selected branches independently and keeps existing data',()=>{
 const s=setup(),a={menu:[item('업무','기존',[item('하위','기존')])]},b={menu:[item('업무','복사',[item('하위','복사'),item('미선택')])]};
 const result=merge(s,a,b,x=>x.id==='menu:0'||x.id==='menu:0.0','importAll');assert.equal(result.menu.length,2);assert.equal(result.menu[0].content,'기존');assert.equal(result.menu[1].children.length,1);assert.equal(result.menu[1].children[0].content,'복사');
});
test('global tabs are compared separately, ignoring ids and active tab selection',()=>{
 const s=setup(),a={menu:[],globalTabs:[{id:'a',title:'공통',content:'동일'},{id:'b',title:'보존',content:'현재만'}],activeGlobalTabId:'b'},b={menu:[],globalTabs:[{id:'other',title:'공통',content:'동일'}],activeGlobalTabId:'other'};
 const records=s.buildBackupComparison(a,b);assert.equal(records.find(x=>x.id==='global:0').status,'same');assert.equal(records.find(x=>x.id==='current-global:1').status,'currentOnly');
 b.globalTabs[0].content='새 공통';const result=merge(s,a,b,x=>x.kind==='global');assert.equal(result.globalTabs.length,2);assert.equal(result.globalTabs[0].content,'새 공통');assert.equal(result.globalTabs[0].id,'a');assert.equal(result.activeGlobalTabId,'b');assert.equal(result.globalManual,'현재만');
});
test('legacy global manual compares with normalized tabs and imports without removing other tabs',()=>{
 const s=setup(),a={menu:[],globalTabs:[{id:'a',title:'전역 메뉴얼',content:'전'},{id:'b',title:'별도',content:'보존'}],activeGlobalTabId:'a'},b={menu:[],globalManual:'후',globalImages:[]};
 const result=merge(s,a,b,x=>x.id==='global:0');assert.equal(result.globalTabs.length,2);assert.equal(result.globalManual,'후');assert.equal(result.globalTabs[1].content,'보존');
 const fromLegacy=merge(s,{menu:[],globalManual:'이전'},b,x=>x.id==='global:0');assert.equal(fromLegacy.globalTabs.length,1);assert.equal(fromLegacy.globalManual,'후');
});
test('new global tabs get distinct ids and do not change the active tab',()=>{
 const s=setup(),a={menu:[],globalTabs:[{id:'imported_global_0',title:'기존',content:'보존'}],activeGlobalTabId:'imported_global_0'},b={menu:[],globalTabs:[{id:'imported_global_0',title:'새 탭',content:'추가'}]};
 const result=merge(s,a,b,x=>x.status==='added');assert.equal(new Set(result.globalTabs.map(x=>x.id)).size,2);assert.equal(result.activeGlobalTabId,'imported_global_0');assert.equal(result.globalManual,'보존');
});
test('image identity ids are ignored but image data, offsets and sizes are compared',()=>{
 const s=setup(),a={menu:[{...item('업무'),images:[{id:'a',url:'local',width:65,offset:0}]}]},b=plain(a);b.menu[0].images[0].id='b';
 assert.equal(s.buildBackupComparison(a,b)[0].status,'same');for(const [field,value] of [['width',50],['offset',2],['url','other']]){const copy=plain(b);copy.menu[0].images[0][field]=value;assert.equal(s.buildBackupComparison(a,copy)[0].status,'changed');}
});
test('table text, colors, merges and embedded images all participate in comparison',()=>{
 const s=setup(),a={menu:[{...item('업무'),tables:[{rows:1,cols:1,cells:[['값']]}]}]};
 for(const change of [t=>t.cells[0][0]='변경',t=>t.cellColors=[['blue']],t=>t.cellMerges={'0:0':{rows:1,cols:2}},t=>t.cellImages=[[[{url:'local',offset:0}]]]]){
  const b=plain(a);change(b.menu[0].tables[0]);const before=JSON.stringify([a,b]);assert.equal(s.buildBackupComparison(a,b)[0].status,'changed');assert.equal(JSON.stringify([a,b]),before);
 }
 const normalized=plain(a);s.normalizeTable(normalized.menu[0].tables[0]);assert.equal(s.buildBackupComparison(a,normalized)[0].status,'same');
});
test('comparison ignores line-ending, absent empty arrays, object key order and nonvisual metadata differences',()=>{
 const s=setup(),a={menu:[{title:'업무',content:'첫째\r\n둘째',custom:{keep:1}}]},b={menu:[{content:'첫째\n둘째',title:'업무',tables:[],images:[],children:[],custom:{keep:2}}]};
 assert.equal(s.buildBackupComparison(a,b)[0].status,'same');
});
test('empty selection changes nothing and malformed apply mode fails before modifying data',()=>{
 const s=setup(),a={menu:[item('업무','전')]},b={menu:[item('업무','후')]},records=s.buildBackupComparison(a,b),before=JSON.stringify(a);
 assert.equal(JSON.stringify(s.mergeBackupComparison(a,b,records,new Set()).data),before);assert.throws(()=>s.mergeBackupComparison(a,b,records,new Set(), 'invalid'));
 assert.equal(JSON.stringify(a),before);
});
test('line diff preserves blank lines, Korean text and original order on both sides',()=>{
 const s=setup();for(const [a,b] of [['첫째\n둘째\n\n끝','첫째\n추가\n둘째\n\n마침'],['','새 본문'],['삭제\n본문',''],['동일\n','동일\n'],['<script>unsafe</script>','**강조**']]){
  const diff=s.diffBackupText(a,b);assert.equal(Array.from(diff.rows,row=>row.left).filter(Boolean).map(x=>x.text).join('\n'),a);assert.equal(Array.from(diff.rows,row=>row.right).filter(Boolean).map(x=>x.text).join('\n'),b);
 }
});
test('large text uses bounded fallback while preserving shared prefix and suffix',()=>{
 const s=setup(),a='시작\n'+Array.from({length:800},(_,i)=>'이전 '+i).join('\n')+'\n끝',b='시작\n'+Array.from({length:800},(_,i)=>'이후 '+i).join('\n')+'\n끝';
 const diff=s.diffBackupText(a,b);assert.equal(diff.fallback,true);assert.equal(diff.rows[0].left.type,'same');assert.equal(diff.rows.at(-1).left.type,'same');assert.equal(diff.rows.length,802);
});


test('legacy description flags and global tab title fallbacks do not create false additions',()=>{
 const s=setup(),a={menu:[{...item('매뉴얼 안내','내용'),isDescriptionSection:true}],globalTabs:[{id:'a',title:'전역 메뉴얼',content:'내용'},{id:'b',title:'전역 2',content:'내용'}]},b={menu:[item('매뉴얼 안내','내용')],globalTabs:[{content:'내용'},{content:'내용'}]};
 assert(s.buildBackupComparison(a,b).every(x=>x.status==='same'));
});

test('line diff reconstruction remains correct with repeated and reordered lines',()=>{
 const s=setup();let seed=71;const random=()=>{seed=(seed*48271)%2147483647;return seed;};
 for(let round=0;round<100;round++){
  const a=Array.from({length:random()%24},()=>['반복','',String(random()%4)][random()%3]).join('\n');
  const b=Array.from({length:random()%24},()=>['반복','',String(random()%4)][random()%3]).join('\n');
  const rows=s.diffBackupText(a,b).rows;
  assert.equal(Array.from(rows,row=>row.left).filter(Boolean).map(x=>x.text).join('\n'),a);
  assert.equal(Array.from(rows,row=>row.right).filter(Boolean).map(x=>x.text).join('\n'),b);
 }
});
