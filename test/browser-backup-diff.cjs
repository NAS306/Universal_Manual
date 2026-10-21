const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process'),assert=require('node:assert/strict');
const projectRoot=path.resolve(__dirname,'..'),tempRoot=require('node:os').tmpdir();
const output=fs.mkdtempSync(path.join(tempRoot,'manual-backup-diff-')),profile=path.join(output,'profile');let port;
fs.mkdirSync(output,{recursive:true});
const child=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));let socket,id=0,chooserResolve;const pending=new Map(),errors=[],requests=[];
function call(method,params={}){return new Promise((resolve,reject)=>{const key=++id,timer=setTimeout(()=>{pending.delete(key);reject(Error('CDP timeout '+method));},20000);pending.set(key,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});socket.send(JSON.stringify({id:key,method,params}));});}
async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
async function until(expression){for(let i=0;i<100;i++){if(await evaluate(expression))return;await sleep(50);}throw Error('Condition timed out '+expression);}
async function click(selector){await evaluate('document.querySelector('+JSON.stringify(selector)+').click()');}
async function screenshot(name){const r=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,name+'.png'),Buffer.from(r.data,'base64'));}
async function openComparison(){console.log('Opening comparison');const chooser=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('File chooser timeout')),8000);chooserResolve=value=>{clearTimeout(timer);resolve(value);};});await evaluate('importBackup()');const event=await chooser;await call('DOM.setFileInputFiles',{files:[path.join(output,'synthetic-backup.json')],backendNodeId:event.backendNodeId});await until("!!document.querySelector('#backup-import-modal[open]')");console.log('Comparison opened');}
const fixture=`(()=>{
 const item=(title,content='',children=[])=>({title,content,children,tables:[],images:[]});
 const d=UniversalManual.debug.getManualData();
 d.manualName='변경 비교 테스트';d.descriptionSectionMigrated=true;
 d.menu=[item('등록 업무','선택하지 않은 부모는 보존합니다.',[{...item('명의이전','1. 신분증 확인\\n2. 기존 서류 접수\\n\\n확인 후 처리합니다.'),tables:[{rows:2,cols:2,cells:[['서류','확인'],['신분증','원본']],cellColors:[['blue','blue'],['','']]}],images:[{id:'image-current',url:'https://example.invalid/sample.png',width:65,offset:0}]},item('현재에만 있는 메모','이 항목은 계속 유지합니다.'),item('같은 내용','바뀌지 않은 내용')]),item('중복 제목','첫 원본'),item('중복 제목','둘째 원본'),{...item('참조','공통 원본',[item('공통확인','기존 공통 확인')]),isReferenceSection:true},{...item('사전','상세 설명',[item('인감증명서&법인인감증명서','기존 해설')]),isDictionarySection:true}];
 d.globalTabs=[{id:'global-a',title:'공통 안내',content:'기존 전역 안내',images:[]},{id:'global-b',title:'보존할 탭',content:'이 탭은 유지합니다.',images:[]}];d.activeGlobalTabId='global-b';
 if(UniversalManual.debug.getCurrentMode()==='edit')toggleMode();toggleMode();toggleMode();
 const b=JSON.parse(JSON.stringify(d));b.menu[0].content='가져온 부모 본문';b.menu[0].children[0].content='1. 신분증 확인\\n2. 새 서류 확인\\n3. 접수 결과 기록\\n\\n확인 후 처리합니다.';
 b.menu[0].children[0].tables[0].cells[1][1]='원본 또는 확인서';b.menu[0].children[0].tables[0].cellColors[1][1]='green';b.menu[0].children[0].images[0].width=50;
 b.menu[0].children=b.menu[0].children.filter(x=>x.title!=='현재에만 있는 메모');b.menu[0].children.push(item('새로 추가할 업무','추가한 설명입니다.'));
 b.menu=b.menu.filter((x,i)=>i!==2);b.menu.find(x=>x.isReferenceSection).children[0].content='새 공통 확인';b.menu.find(x=>x.isDictionarySection).children[0].content='새 해설';
 b.globalTabs=[{id:'incoming-a',title:'공통 안내',content:'새 전역 안내',images:[]},{id:'incoming-new',title:'새 전역 탭',content:'추가 안내',images:[]}];
 window.__fixtureBackup=b;window.__alerts=[];window.alert=text=>window.__alerts.push(text);return JSON.stringify(b);
})()`;
async function main(){
 let targets;for(let i=0;i<100;i++){try{port=Number(fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0]);targets=await(await fetch('http://127.0.0.1:'+port+'/json')).json();if(targets.length)break;}catch{}await sleep(100);}
 socket=new WebSocket(targets.find(x=>x.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
 socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(m.error)p.reject(Error(JSON.stringify(m.error)));else p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);else if(m.method==='Page.fileChooserOpened'){chooserResolve?.(m.params);chooserResolve=null;}else if(m.method==='Network.requestWillBeSent'&&/^https?:/.test(m.params.request.url))requests.push(m.params.request.url);});
 await call('Runtime.enable');await call('Page.enable');await call('Network.enable');await call('Network.setBlockedURLs',{urls:['http://*','https://*']});await call('Page.setInterceptFileChooserDialog',{enabled:true});
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1050,deviceScaleFactor:1,mobile:false});
 await call('Page.navigate',{url:require('node:url').pathToFileURL(path.join(projectRoot,'index.html')).href});await until('!!window.UniversalManual?.debug');
 console.log('Page ready');fs.writeFileSync(path.join(output,'synthetic-backup.json'),await evaluate(fixture));
 const before=await evaluate('JSON.stringify(UniversalManual.debug.getManualData())');await openComparison();
 assert.equal(await evaluate('UniversalManual.version'),'5.0');
 assert.equal(await evaluate("document.querySelectorAll('.backup-diff-row .diff-same').length"),0);
 assert.equal(await evaluate("document.querySelectorAll('.backup-diff-row .diff-ambiguous').length"),3);
 assert.equal(await evaluate("document.querySelector('.backup-import-apply').disabled"),true);
 await evaluate("document.getElementById('backup-diff-filter').value='all';document.getElementById('backup-diff-filter').dispatchEvent(new Event('change'));document.querySelector('.backup-import-controls input[type=search]').value='명의이전';document.querySelector('.backup-import-controls input[type=search]').dispatchEvent(new Event('input'));");
 assert.equal(await evaluate("document.querySelectorAll('.backup-diff-row').length"),1);await click('.backup-import-controls button');assert.equal(await evaluate("document.querySelector('.backup-diff-selection').textContent"),'1개 선택');
 await evaluate("document.querySelector('.backup-import-controls input[type=search]').value='';document.querySelector('.backup-import-controls input[type=search]').dispatchEvent(new Event('input'));document.getElementById('backup-diff-filter').value='differences';document.getElementById('backup-diff-filter').dispatchEvent(new Event('change'));document.querySelectorAll('.backup-import-controls button')[1].click();");
 await click('.backup-diff-row[data-id="menu:0.0"] button');
 const detail=await evaluate("({removed:document.querySelectorAll('.backup-diff-line.removed').length,added:document.querySelectorAll('.backup-diff-line.added').length,cells:document.querySelectorAll('.backup-diff-cell-changed').length,text:document.querySelector('.backup-diff-detail').textContent})");
 assert(detail.removed>0);assert(detail.added>0);assert(detail.cells>=2);assert(detail.text.includes('너비 50%'));
 assert.equal(await evaluate('JSON.stringify(UniversalManual.debug.getManualData())'),before);
 await screenshot('comparison-modern');
 const themes=[];for(const theme of ['pixel','matrix','oldAndFaithful','boringAndCliche']){await evaluate('document.documentElement.dataset.theme='+JSON.stringify(theme));await sleep(150);const metrics=await evaluate("(()=>{const d=document.querySelector('.backup-import-dialog');return {horizontalOverflow:d.scrollWidth>d.clientWidth+1,width:d.clientWidth,height:d.clientHeight};})()");assert(!metrics.horizontalOverflow,theme);themes.push({theme,...metrics});if(theme==='pixel'||theme==='matrix')await screenshot('comparison-'+theme);}
 await evaluate("document.documentElement.dataset.theme='modern'");
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await sleep(100);await screenshot('comparison-mobile');assert.equal(await evaluate("document.querySelector('.backup-import-dialog').scrollWidth>document.querySelector('.backup-import-dialog').clientWidth+1"),false);
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1050,deviceScaleFactor:1,mobile:false});
 await click('.backup-diff-row[data-id="menu:0.0"] input');await click('.backup-import-apply');
 await until("!document.getElementById('backup-import-modal')");
 const after=await evaluate('JSON.parse(JSON.stringify(UniversalManual.debug.getManualData()))');assert.equal(after.menu[0].content,'선택하지 않은 부모는 보존합니다.');assert(after.menu[0].children[0].content.includes('새 서류'));assert(after.menu[0].children.some(x=>x.title==='현재에만 있는 메모'));assert(!after.menu[0].children.some(x=>x.title==='새로 추가할 업무'));assert.equal(after.globalTabs.length,2);assert.equal(after.activeGlobalTabId,'global-b');
 await evaluate('toggleMode()');await call('Input.dispatchKeyEvent',{type:'keyDown',key:'z',code:'KeyZ',modifiers:2,windowsVirtualKeyCode:90});assert.equal(await evaluate('UniversalManual.debug.getManualData().menu[0].children[0].content'),JSON.parse(before).menu[0].children[0].content);
 // A failed browser write must roll back both data and undo history and allow retry.
 await openComparison();const beforeFailure=await evaluate('JSON.stringify(UniversalManual.debug.getManualData())');await click('.backup-diff-row[data-id="menu:0.0"] input');
 await evaluate("window.__setItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith('manualData('))throw new DOMException('full','QuotaExceededError');return window.__setItem.call(this,k,v);}");await click('.backup-import-apply');
 assert.equal(await evaluate('JSON.stringify(UniversalManual.debug.getManualData())'),beforeFailure);assert.equal(await evaluate("document.getElementById('backup-import-modal').open"),true);assert(await evaluate("window.__alerts.at(-1).includes('현재 자료를 유지')"));
 await evaluate('Storage.prototype.setItem=window.__setItem');await click('.backup-import-apply');await until("!document.getElementById('backup-import-modal')");
 // Cancel and stale-comparison checks.
 await openComparison();await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await until("!document.getElementById('backup-import-modal')");
 await openComparison();await click('.backup-diff-row[data-id="menu:0"] input');await evaluate("UniversalManual.debug.getManualData().menu[0].content='비교 후 외부 변경'");await click('.backup-import-apply');assert(await evaluate("window.__alerts.at(-1).includes('비교 중 변경')"));assert.equal(await evaluate("document.getElementById('backup-import-modal').open"),true);
 await click('.backup-import-close');
 fs.writeFileSync(path.join(output,'synthetic-backup.json'),await evaluate(fixture));
 await openComparison();await click('.backup-diff-row[data-id="menu:0.0"] input');
 await evaluate("const k=UniversalManual.debug.getActiveStorageKey();window.__storedBefore=localStorage.getItem(k);const external=JSON.parse(window.__storedBefore);external.menu[0].content='다른 탭 저장';localStorage.setItem(k,JSON.stringify(external));");await click('.backup-import-apply');assert(await evaluate("window.__alerts.at(-1).includes('비교 중 변경')"));
 const externalStored=await evaluate('localStorage.getItem(UniversalManual.debug.getActiveStorageKey())');await click('.backup-import-close');await evaluate('toggleMode()');assert.equal(await evaluate('localStorage.getItem(UniversalManual.debug.getActiveStorageKey())'),externalStored);
 await call('Page.reload');await sleep(150);await until('!!window.UniversalManual?.debug');assert.equal(await evaluate('UniversalManual.debug.getManualData().menu[0].content'),'다른 탭 저장');fs.writeFileSync(path.join(output,'synthetic-backup.json'),await evaluate(fixture));
 // New-only through the actual UI, including changed-ancestor protection.
 await openComparison();await evaluate("document.getElementById('backup-diff-method').value='newOnly';document.getElementById('backup-diff-method').dispatchEvent(new Event('change'));");
 assert.equal(await evaluate("document.querySelector('.backup-diff-row[data-id=\"menu:0\"] input').disabled"),true);
 await click('.backup-diff-row[data-id="menu:0.2"] input');await click('.backup-import-apply');await until("!document.getElementById('backup-import-modal')");
 assert.equal(await evaluate('UniversalManual.debug.getManualData().menu[0].children.length'),4);assert.equal(await evaluate('UniversalManual.debug.getManualData().menu[0].content'),'선택하지 않은 부모는 보존합니다.');
 // Ambiguous entry can only be imported as a separate copy.
 await openComparison();await evaluate("document.getElementById('backup-diff-method').value='importAll';document.getElementById('backup-diff-method').dispatchEvent(new Event('change'));");await click('.backup-diff-row[data-id="menu:1"] input');await click('.backup-import-apply');await until("!document.getElementById('backup-import-modal')");
 assert.equal(await evaluate("UniversalManual.debug.getManualData().menu.filter(x=>x.title==='중복 제목').length"),3);
 // Stored markup remains inert in both the list and line comparison.
 const unsafe=await evaluate("(()=>{const b=JSON.parse(JSON.stringify(UniversalManual.debug.getManualData()));b.menu[0].children[0].content='<img src=x onerror=window.__diffExecuted=true>';b.menu[0].children[0].title='<svg onload=window.__diffExecuted=true>';return JSON.stringify(b);})()");fs.writeFileSync(path.join(output,'synthetic-backup.json'),unsafe);await openComparison();await click('.backup-diff-row[data-id="menu:0.0"] button');
 assert.equal(await evaluate('window.__diffExecuted===true'),false);assert.equal(await evaluate("document.querySelectorAll('.backup-diff-detail img,.backup-diff-row svg').length"),0);await click('.backup-import-close');
 // End-to-end smoke timing with 4x CPU throttling and an approximately 1 MB synthetic manual.
 const large=await evaluate("(()=>{const d=UniversalManual.debug.getManualData();d.menu=Array.from({length:800},(_,i)=>({title:'업무 '+i,content:('업무 안내 '+i+' ').repeat(80),children:[],tables:[],images:[]}));if(UniversalManual.debug.getCurrentMode()==='edit')toggleMode();toggleMode();toggleMode();const b=JSON.parse(JSON.stringify(d));for(let i=0;i<20;i++)b.menu[i].content+='새 안내';b.menu.splice(780,20);for(let i=0;i<20;i++)b.menu.push({title:'신규 '+i,content:'새 본문',children:[],tables:[],images:[]});return JSON.stringify(b);})()");fs.writeFileSync(path.join(output,'synthetic-backup.json'),large);
 await call('Emulation.setCPUThrottlingRate',{rate:4});await evaluate('window.__diffStart=performance.now()');await openComparison();const performanceResult=await evaluate("({elapsedMs:Math.round(performance.now()-window.__diffStart),visible:document.querySelectorAll('.backup-diff-row').length})");await call('Emulation.setCPUThrottlingRate',{rate:1});
 assert.equal(errors.length,0,JSON.stringify(errors));assert.equal(requests.length,0,JSON.stringify(requests));
 const report={themes,bodyDiff:{removed:detail.removed,added:detail.added,changedCells:detail.cells},performanceResult,checks:['file import','filters and scoped bulk selection','read-only comparison','partial child apply','current-only preserved','global tabs preserved','undo','save failure rollback and retry','Escape','stale in-memory/storage comparison blocked','new-only UI','ambiguous import-all UI','inert markup','all themes','mobile layout','4x CPU smoke'],browserErrors:errors.length,externalRequests:requests.length};fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
 if(socket?.readyState===1){try{await call('Browser.close');}catch{}socket.close();}else child.kill();
 await sleep(500);
 // Check the resolved cleanup target before deleting the isolated test profile.
 if(path.dirname(output)!==path.resolve(tempRoot)||!path.basename(output).startsWith('manual-backup-diff-'))throw Error('Unexpected test directory');
 fs.rmSync(profile,{recursive:true,force:true,maxRetries:20,retryDelay:100});
 if(process.env.MANUAL_DIFF_KEEP_ARTIFACTS==='1')console.log('Screenshots and report: '+output);
 else fs.rmSync(output,{recursive:true,force:true,maxRetries:10,retryDelay:100});
});
