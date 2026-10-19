const fs=require('fs'),path=require('path'),vm=require('vm'),{performance}=require('perf_hooks');
const root=path.resolve(__dirname,'..');const read=n=>fs.readFileSync(path.join(root,'src/js',n),'utf8');
const s={manualData:{menu:[]},window:{},closeContextMenusOnOutsidePointer(){},document:{addEventListener(){}}};vm.createContext(s);vm.runInContext(read('30-markdown-reference.js')+'\n'+read('95-backup-menu.js'),s);
const names=Array.from({length:500},(_,i)=>'자동차등록용어'+i),text='자동차등록용어499와 자동차등록용어1을 확인합니다.';
const run=(label,fn)=>{const times=[];let output;for(let i=0;i<4;i++){const start=performance.now();output=fn();times.push(performance.now()-start);}times.shift();times.sort((a,b)=>a-b);console.log(label+': '+times[1].toFixed(1)+'ms',output);};
run('dictionary 500 terms / 2000 text nodes',()=>{let hits=0;for(let i=0;i<2000;i++)hits+=s.getDictionaryMatches(text,names).length;return hits;});
let item={title:'leaf',content:'x'.repeat(100),children:[]};const paths=new Set();for(let i=0;i<150;i++){item={title:'node'+i,content:'y'.repeat(100),children:[item]};}let node=item,p=[];while(node){paths.add(p.join('.'));node=node.children[0];p.push(0);}
run('backup select depth 150 / 10 copies',()=>{let n=0;for(let i=0;i<10;i++){if(s.cloneManualItemForImport(item,[],paths))n++;}return n;});
