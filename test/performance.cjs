const fs=require('fs'),path=require('path'),vm=require('vm'),{performance}=require('perf_hooks');
const root=path.resolve(__dirname,'..');const read=n=>fs.readFileSync(path.join(root,'src/js',n),'utf8');
const s={manualData:{menu:[]},window:{},DEFAULT_GLOBAL_TAB_TITLE:'전역 메뉴얼',getDefaultReferenceSectionTitle:()=> '참조',closeContextMenusOnOutsidePointer(){},document:{addEventListener(){}}};vm.createContext(s);vm.runInContext(read('30-markdown-reference.js')+'\n'+read('60-accordion-core.js')+'\n'+read('93-backup-diff.js'),s);
const names=Array.from({length:500},(_,i)=>'자동차등록용어'+i),text='자동차등록용어499와 자동차등록용어1을 확인합니다.';
const run=(label,fn)=>{const times=[];let output;for(let i=0;i<4;i++){const start=performance.now();output=fn();times.push(performance.now()-start);}times.shift();times.sort((a,b)=>a-b);console.log(label+': '+times[1].toFixed(1)+'ms',output);};
run('dictionary 500 terms / 2000 text nodes',()=>{let hits=0;for(let i=0;i<2000;i++)hits+=s.getDictionaryMatches(text,names).length;return hits;});
let item={title:'leaf',content:'x'.repeat(100),children:[]};for(let i=0;i<150;i++)item={title:'node'+i,content:'y'.repeat(100),children:[item]};
const current={menu:[item]},incoming=JSON.parse(JSON.stringify(current));let leaf=incoming.menu[0];while(leaf.children.length)leaf=leaf.children[0];leaf.content='changed';
run('backup compare and selected merge, depth 150 / 10 copies',()=>{let count=0;for(let i=0;i<10;i++){const records=s.buildBackupComparison(current,incoming);const selected=new Set(records.filter(r=>r.status==='changed').map(r=>r.id));count+=s.mergeBackupComparison(current,incoming,records,selected).applied;}return count;});
