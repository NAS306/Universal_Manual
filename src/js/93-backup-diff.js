// Read-only two-way comparison and selective merging. No DOM or storage writes.
// Titles within the same parent identify entries; duplicates are never guessed.
const BACKUP_DIFF_LABELS = Object.freeze({added:'추가',changed:'변경',same:'동일',currentOnly:'현재에만 있음',ambiguous:'대응 확인 필요'});
const cloneBackupValue = value => JSON.parse(JSON.stringify(value));
function stableBackupValue(value) {
  if (Array.isArray(value)) return value.map(stableBackupValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key,stableBackupValue(value[key])]));
  return value;
}
function backupValuesEqual(left, right) {
  return JSON.stringify(stableBackupValue(left)) === JSON.stringify(stableBackupValue(right));
}
function backupImageValues(images) {
  return normalizeImageList(images).map(({id,...image}) => image);
}
function backupTableValues(tables) {
  return (Array.isArray(tables) ? tables : []).map(table => {
    const normalized = normalizeTable(cloneBackupValue(table));
    return {rows:normalized.rows,cols:normalized.cols,cells:normalized.cells,cellColors:normalized.cellColors,
      cellMerges:normalized.cellMerges,cellImages:normalized.cellImages.map(row => row.map(backupImageValues))};
  });
}
function backupContentValue(item) {
  return {content:String(item?.content || '').replace(/\r\n?/g,'\n'),tables:backupTableValues(item?.tables),images:backupImageValues(item?.images)};
}
function backupItemKey(item) {
  const role = item?.isDictionarySection ? 'dictionary' : isReferenceSection(item) ? 'reference' : 'ordinary';
  return JSON.stringify([role,String(item?.title || '')]);
}
function backupGlobalTabs(data) {
  if (Array.isArray(data.globalTabs) && data.globalTabs.length) return data.globalTabs.map((tab,index) => ({...tab,
    title:String(tab?.title || (index === 0 ? DEFAULT_GLOBAL_TAB_TITLE : '전역 '+(index+1))).trim(),content:String(tab?.content || ''),images:tab?.images || []}));
  if (!backupDataHasGlobalManual(data)) return [];
  return [{title:DEFAULT_GLOBAL_TAB_TITLE,content:String(data.globalManual || ''),images:data.globalImages || []}];
}
function backupDataHasGlobalManual(data) {
  return ['globalManual','globalImages','globalTabs'].some(key => Object.prototype.hasOwnProperty.call(data,key));
}
function buildBackupComparison(currentData, incomingData) {
  const records = [];
  function compare(leftItems, rightItems, kind, leftParent = [], rightParent = [], trail = [], blocked = false) {
    const keyOf = kind === 'global' ? item => String(item.title || DEFAULT_GLOBAL_TAB_TITLE) : backupItemKey;
    const group = items => {
      const map = new Map();
      items.forEach((item,index) => {const key = keyOf(item); if (!map.has(key)) map.set(key,[]); map.get(key).push(index);});
      return map;
    };
    const leftGroups = group(leftItems), rightGroups = group(rightItems), matched = new Set();
    rightItems.forEach((incoming,index) => {
      const candidates = leftGroups.get(keyOf(incoming)) || [];
      const ambiguous = blocked || candidates.length > 1 || rightGroups.get(keyOf(incoming)).length > 1;
      const leftIndex = !ambiguous && candidates.length === 1 ? candidates[0] : -1;
      const current = leftIndex < 0 ? null : leftItems[leftIndex];
      if (current) matched.add(leftIndex);
      const incomingPath = [...rightParent,index], currentPath = current ? [...leftParent,leftIndex] : null;
      const breadcrumb = [...trail,String(incoming.title || '(이름 없는 항목)')];
      const record = {id:kind+':'+incomingPath.join('.'),kind,incomingPath,currentPath,current,incoming,breadcrumb,
        status:ambiguous ? 'ambiguous' : !current ? 'added' : backupValuesEqual(backupContentValue(current),backupContentValue(incoming)) ? 'same' : 'changed'};
      records.push(record);
      if (kind === 'menu') compare(current?.children || [],incoming.children || [],kind,currentPath || [],incomingPath,breadcrumb,ambiguous);
    });
    leftItems.forEach((current,index) => {
      if (matched.has(index)) return;
      const currentPath = [...leftParent,index], breadcrumb = [...trail,String(current.title || '(이름 없는 항목)')];
      records.push({id:'current-'+kind+':'+currentPath.join('.'),kind,currentPath,incomingPath:null,current,incoming:null,breadcrumb,
        status:rightGroups.has(keyOf(current)) ? 'ambiguous' : 'currentOnly'});
      if (kind === 'menu') compare(current.children || [],[],kind,currentPath,[],breadcrumb);
    });
  }
  compare(backupGlobalTabs(currentData),backupGlobalTabs(incomingData),'global',[],[],['전역 매뉴얼']);
  compare(currentData.menu || [],incomingData.menu || [],'menu');
  return records;
}
function canApplyBackupRecord(record, mode = 'overwrite') {
  if (!record.incoming) return false;
  if (mode === 'importAll') return true;
  if (record.status === 'ambiguous') return false;
  return mode !== 'newOnly' || record.status === 'added';
}
function mergeBackupComparison(currentData, incomingData, records, selectedIds, mode = 'overwrite') {
  if (!['overwrite','newOnly','importAll'].includes(mode)) throw new Error('알 수 없는 불러오기 방식입니다.');
  const result = cloneBackupValue(currentData);
  const selected = records.filter(record => selectedIds.has(record.id) && canApplyBackupRecord(record,mode));
  if (!selected.length) return {data:result,applied:0};
  const byId = new Map(records.map(record => [record.id,record]));
  const chosen = new Set(selected.map(record => record.id)), needed = new Set();
  selected.filter(record => record.kind === 'menu').forEach(record => {
    for (let depth=1;depth<=record.incomingPath.length;depth++) needed.add(record.incomingPath.slice(0,depth).join('.'));
  });
  function itemAt(items, path) {
    let item;
    for (const index of path) {item = items[index]; items = item.children || [];}
    return item;
  }
  function visit(incomingItems, targetItems, parent = [], newBranch = false) {
    incomingItems.forEach((incoming,index) => {
      const path = [...parent,index], key = path.join('.');
      if (!needed.has(key)) return;
      const record = byId.get('menu:'+key), isChosen = chosen.has(record.id);
      // An ambiguous ancestor may only be copied as a separate branch, never merged.
      if (record.status === 'ambiguous' && mode !== 'importAll') throw new Error('대응이 불명확한 상위 항목입니다.');
      let target = !newBranch && record.currentPath ? itemAt(result.menu,record.currentPath) : null;
      const add = !target || mode === 'importAll' && isChosen;
      if (add) {
        const {children,...fields} = cloneBackupValue(incoming);
        target = {...fields,children:[]}; targetItems.push(target);
      } else if (isChosen && mode === 'overwrite') {
        // Omitted legacy fields mean empty content; unrelated custom metadata survives.
        const {children,...fields} = cloneBackupValue(incoming);
        const replacement = {...target,...fields,content:incoming.content || '',tables:cloneBackupValue(incoming.tables || []),images:cloneBackupValue(incoming.images || []),children:target.children || []};
        Object.keys(replacement).forEach(key => Object.defineProperty(target,key,{value:replacement[key],writable:true,enumerable:true,configurable:true}));
      }
      if (!Array.isArray(target.children)) target.children = [];
      visit(incoming.children || [],target.children,path,newBranch || add);
    });
  }
  result.menu ||= [];
  visit(incomingData.menu || [],result.menu);
  const globals = selected.filter(record => record.kind === 'global');
  if (globals.length) {
    result.globalTabs = cloneBackupValue(backupGlobalTabs(currentData));
    const usedIds = new Set(result.globalTabs.map(tab => tab.id).filter(Boolean));
    let nextId = 0;
    const newId = () => {let value; do {value='imported_global_'+nextId++;} while (usedIds.has(value)); usedIds.add(value); return value;};
    result.globalTabs.forEach(tab => {if (!tab.id) tab.id = newId();});
    globals.forEach(record => {
      const incoming = cloneBackupValue(record.incoming), index = record.currentPath?.[0];
      if (index != null && mode === 'overwrite') {
        const target = result.globalTabs[index];
        result.globalTabs[index] = {...target,...incoming,id:target.id,content:incoming.content || '',images:incoming.images || []};
      } else result.globalTabs.push({...incoming,id:newId()});
    });
    const active = result.globalTabs.find(tab => tab.id === result.activeGlobalTabId) || result.globalTabs[0];
    result.activeGlobalTabId = active.id; result.globalManual = active.content || ''; result.globalImages = active.images || [];
  }
  return {data:result,applied:selected.length};
}

// Bounded line diff: long documents fall back to marking the changed block.
// Common prefix/suffix stay aligned; no quadratic work on large bodies.
function diffBackupText(leftText, rightText) {
  const left = String(leftText || '').replace(/\r\n?/g,'\n').split('\n');
  const right = String(rightText || '').replace(/\r\n?/g,'\n').split('\n');
  let start = 0, end = 0;
  while (start<left.length && start<right.length && left[start]===right[start]) start++;
  while (end<left.length-start && end<right.length-start && left[left.length-1-end]===right[right.length-1-end]) end++;
  const a = left.slice(start,left.length-end), b = right.slice(start,right.length-end), ops = [];
  for (let index=0;index<start;index++) ops.push({type:'same',text:left[index]});
  const fallback = a.length*b.length > 250000 || a.length+b.length > 2000;
  if (fallback) {
    a.forEach(text => ops.push({type:'removed',text})); b.forEach(text => ops.push({type:'added',text}));
  } else {
    const lengths = Array.from({length:a.length+1},() => new Uint16Array(b.length+1));
    for (let i=a.length-1;i>=0;i--) for (let j=b.length-1;j>=0;j--) lengths[i][j] = a[i]===b[j] ? lengths[i+1][j+1]+1 : Math.max(lengths[i+1][j],lengths[i][j+1]);
    let i=0,j=0;
    while (i<a.length || j<b.length) {
      if (i<a.length && j<b.length && a[i]===b[j]) {ops.push({type:'same',text:a[i]});i++;j++;}
      else if (j>=b.length || i<a.length && lengths[i+1][j]>=lengths[i][j+1]) ops.push({type:'removed',text:a[i++]});
      else ops.push({type:'added',text:b[j++]});
    }
  }
  for (let index=left.length-end;index<left.length;index++) ops.push({type:'same',text:left[index]});
  const rows = []; let leftLine=1,rightLine=1,removed=[],added=[];
  function flush() {
    for (let index=0;index<Math.max(removed.length,added.length);index++) rows.push({
      left:index<removed.length ? {text:removed[index],number:leftLine++,type:'removed'} : null,
      right:index<added.length ? {text:added[index],number:rightLine++,type:'added'} : null
    });
    removed=[]; added=[];
  }
  ops.forEach(op => {
    if (op.type==='removed') removed.push(op.text);
    else if (op.type==='added') added.push(op.text);
    else {flush(); rows.push({left:{text:op.text,number:leftLine++,type:'same'},right:{text:op.text,number:rightLine++,type:'same'}});}
  });
  flush(); return {rows,fallback};
}
