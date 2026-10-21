// Backup review UI. Imported text is always displayed as text, never executable HTML.
function closeBackupImportModal() {
  const modal = document.getElementById('backup-import-modal');
  if (!modal) return;
  const opener = modal.backupOpener;
  modal.close(); modal.remove();
  if (opener?.isConnected) opener.focus({preventScroll:true});
}
function backupDiffElement(tag, className = '', text = '') {
  const node = document.createElement(tag); node.className = className; node.textContent = text; return node;
}
function backupDiffBadge(status) {return backupDiffElement('span','backup-diff-badge diff-'+status,BACKUP_DIFF_LABELS[status]);}
function appendBackupTextDiff(container, current, incoming) {
  container.append(backupDiffElement('h4','','본문'));
  const grid = backupDiffElement('div','backup-text-diff');
  grid.append(backupDiffElement('div','backup-diff-column-title','현재 내용 · − 삭제/교체'),backupDiffElement('div','backup-diff-column-title','가져온 내용 · + 추가/교체'));
  const preview = item => String(item?.content || '').slice(0,100000).split('\n').slice(0,2000).join('\n');
  const before = preview(current), after = preview(incoming), diff = diffBackupText(before,after);
  diff.rows.slice(0,2400).forEach(row => {
    for (const side of ['left','right']) {
      const line = row[side], cell = backupDiffElement('div','backup-diff-line '+(line?.type || 'empty'));
      const prefix = line ? (line.type==='removed' ? '−' : line.type==='added' ? '+' : ' ')+' '+line.number : '';
      cell.append(backupDiffElement('span','backup-diff-line-number',prefix),backupDiffElement('span','backup-diff-line-text',line?.text || '\u200b'));
      grid.append(cell);
    }
  });
  container.append(grid);
  if (before!==String(current?.content || '') || after!==String(incoming?.content || '') || diff.rows.length>2400) container.append(backupDiffElement('p','backup-diff-note','긴 본문은 미리보기 일부만 표시합니다. 적용할 때는 원문 전체를 사용합니다.'));
  else if (diff.fallback) container.append(backupDiffElement('p','backup-diff-note','변경 범위가 넓어 해당 구간 전체를 강조했습니다.'));
}
function appendBackupTableDiff(container, current, incoming) {
  const left = backupTableValues(current?.tables), right = backupTableValues(incoming?.tables);
  if (!left.length && !right.length) return;
  container.append(backupDiffElement('h4','','표 · '+(backupValuesEqual(left,right) ? '동일' : '변경')));
  const pair = backupDiffElement('div','backup-diff-pair');
  for (const [tables,other,label] of [[left,right,'현재 표'],[right,left,'가져온 표']]) {
    const column = backupDiffElement('div','backup-diff-table-column'); column.append(backupDiffElement('h5','',label));
    if (!tables.length) column.append(backupDiffElement('p','backup-diff-note','표 없음'));
    tables.forEach((table,index) => {
      column.append(backupDiffElement('p','backup-diff-note','표 '+(index+1)+' · '+table.rows+'행 × '+table.cols+'열'));
      const wrap = backupDiffElement('div','backup-diff-table-wrap'), element = document.createElement('table');
      element.setAttribute('aria-label',label+' '+(index+1));
      table.cells.slice(0,100).forEach((row,r) => {
        const tr = document.createElement('tr');
        row.slice(0,30).forEach((text,c) => {
          const cell = backupDiffElement('td','',text);
          const imageCount = table.cellImages[r][c].length, merge = table.cellMerges[getTableCellKey(r,c)];
          if (imageCount) cell.append(backupDiffElement('small','',' · 이미지 '+imageCount+'개'));
          if (merge) cell.append(backupDiffElement('small','',' · 병합 '+merge.rows+'×'+merge.cols));
          const peer = other[index];
          if (!peer || !backupValuesEqual([text,table.cellColors[r][c],table.cellImages[r][c],merge || null],
            [peer.cells[r]?.[c],peer.cellColors[r]?.[c],peer.cellImages[r]?.[c],peer.cellMerges[getTableCellKey(r,c)] || null])) cell.classList.add('backup-diff-cell-changed');
          if (table.cellColors[r][c]) cell.dataset.color = table.cellColors[r][c];
          tr.append(cell);
        });
        element.append(tr);
      });
      wrap.append(element); column.append(wrap);
      if (table.rows>100 || table.cols>30) column.append(backupDiffElement('p','backup-diff-note','큰 표는 처음 100행·30열만 표시합니다. 적용 시 전체 표가 반영됩니다.'));
    });
    pair.append(column);
  }
  container.append(pair);
}
function appendBackupImageDiff(container, current, incoming) {
  const left = backupImageValues(current?.images), right = backupImageValues(incoming?.images);
  if (!left.length && !right.length) return;
  container.append(backupDiffElement('h4','','본문 이미지 · '+(backupValuesEqual(left,right) ? '동일' : '변경')));
  const pair = backupDiffElement('div','backup-diff-pair');
  for (const [images,other,label] of [[left,right,'현재 이미지'],[right,left,'가져온 이미지']]) {
    const column = backupDiffElement('div','backup-diff-image-column'); column.append(backupDiffElement('h5','',label));
    if (!images.length) column.append(backupDiffElement('p','backup-diff-note','이미지 없음'));
    images.forEach((image,index) => {
      const changed = !backupValuesEqual(image,other[index]);
      const item = backupDiffElement('p','backup-diff-image-info'+(changed ? ' backup-diff-cell-changed' : ''));
      const address = image.url.startsWith('data:') ? '내장 이미지' : image.url.slice(0,200)+(image.url.length>200 ? '…' : '');
      item.textContent = (index+1)+'. '+(changed ? '[변경] ' : '')+address+'\n너비 '+image.width+'% · 본문 위치 '+(image.offset===Number.MAX_SAFE_INTEGER ? '끝' : image.offset);
      column.append(item);
    });
    pair.append(column);
  }
  container.append(pair,backupDiffElement('p','backup-diff-note','비교 중에는 외부 이미지 주소에 접속하지 않습니다. 저장된 이미지 데이터·주소·위치·크기를 비교합니다. 같은 외부 주소의 실제 파일 교체는 감지하지 못합니다.'));
}
function openBackupImportModal(backupData, fileName = '선택한 백업') {
  closeBackupImportModal();
  if (currentMode === 'edit') saveGlobalEditorContent();
  if (!saveToLocalStorage(true)) return;
  setButtonMenuOpen(false);
  const snapshot = JSON.stringify(manualData), storageKey = activeStorageKey, storedSnapshot = localStorage.getItem(activeStorageKey);
  const records = buildBackupComparison(manualData,backupData), selected = new Set();
  let active = records.find(record => record.status!=='same') || records[0], mode = 'overwrite';
  const modal = backupDiffElement('dialog','backup-import-modal backup-diff-modal');
  modal.id = 'backup-import-modal'; modal.backupOpener = document.getElementById('menu-toggle');
  modal.setAttribute('aria-labelledby','backup-diff-heading');
  const dialog = backupDiffElement('div','backup-import-dialog');
  const header = backupDiffElement('div','backup-import-header'), heading = backupDiffElement('h3','','백업 변경 비교');
  heading.id = 'backup-diff-heading';
  const close = backupDiffElement('button','backup-import-close','닫기'); close.type='button'; close.addEventListener('click',closeBackupImportModal);
  header.append(heading,close);
  const intro = backupDiffElement('div','backup-diff-intro');
  intro.append(backupDiffElement('p','','현재: '+getManualName()+'  /  가져온 파일: '+fileName),backupDiffElement('p','backup-diff-note','차이는 최신 여부를 뜻하지 않습니다. 선택한 항목만 반영하며, 파일에 없는 현재 항목은 삭제하지 않습니다.'));
  const summary = backupDiffElement('div','backup-diff-summary');
  for (const status of Object.keys(BACKUP_DIFF_LABELS)) {
    const count = records.filter(record => record.status===status).length;
    if (count) {const badge=backupDiffBadge(status);badge.append(' '+count);summary.append(badge);}
  }
  const controls = backupDiffElement('div','backup-import-controls');
  const filter = document.createElement('select'); filter.id='backup-diff-filter'; filter.setAttribute('aria-label','비교 결과 필터');
  for (const [value,label] of [['differences','차이 있는 항목'],['all','모든 항목'],['added','추가'],['changed','변경'],['currentOnly','현재에만 있음'],['ambiguous','대응 확인 필요']]) {const option=new Option(label,value);filter.add(option);}
  const search = document.createElement('input'); search.type='search';search.placeholder='항목 이름·경로 찾기';search.setAttribute('aria-label','비교 항목 찾기');
  const selectVisible = backupDiffElement('button','','표시 항목 선택'), clear = backupDiffElement('button','','선택 해제');
  selectVisible.type=clear.type='button';
  controls.append(filter,search,selectVisible,clear);
  const methodLabel=backupDiffElement('label','','반영 방식 '), method=document.createElement('select');method.id='backup-diff-method';
  for (const [value,label] of [['overwrite','선택한 내용으로 갱신'],['newOnly','새로운 항목만 추가'],['importAll','선택한 항목을 별도로 추가']]) method.add(new Option(label,value));
  methodLabel.append(method); controls.append(methodLabel);
  const workspace=backupDiffElement('div','backup-diff-workspace'),list=backupDiffElement('div','backup-import-tree backup-diff-list'),detail=backupDiffElement('section','backup-diff-detail');
  list.setAttribute('aria-label','비교 항목 목록');detail.setAttribute('aria-label','선택 항목의 변경 내용');
  workspace.append(list,detail);
  const footer=backupDiffElement('div','backup-import-footer'),selectionCount=backupDiffElement('span','backup-diff-selection');
  selectionCount.setAttribute('role','status');
  const cancel=backupDiffElement('button','backup-import-cancel','취소'),apply=backupDiffElement('button','backup-import-apply','선택 항목 불러오기');
  cancel.type=apply.type='button';cancel.addEventListener('click',closeBackupImportModal);
  footer.append(selectionCount,cancel,apply);
  function updateCount() {selectionCount.textContent=selected.size+'개 선택';apply.disabled=selected.size===0;}
  function visibleRecords() {
    const query=search.value.trim().toLocaleLowerCase();
    return records.filter(record => (filter.value==='all' || filter.value==='differences' && record.status!=='same' || record.status===filter.value)
      && (!query || record.breadcrumb.join(' / ').toLocaleLowerCase().includes(query)));
  }
  function showDetail(record) {
    active=record;detail.replaceChildren();
    list.querySelectorAll('.backup-diff-row').forEach(row => {const chosen=row.dataset.id===record.id;row.classList.toggle('active',chosen);row.querySelector('button').setAttribute('aria-pressed',String(chosen));});
    const title=backupDiffElement('h4','backup-diff-path',record.breadcrumb.join(' / '));detail.append(title,backupDiffBadge(record.status));
    if (record.status==='ambiguous') detail.append(backupDiffElement('p','backup-diff-note','같은 계층의 제목이 중복되어 자동으로 대응시키지 않았습니다. 필요한 경우 “별도로 추가”로 가져온 뒤 직접 정리하세요.'));
    if (record.status==='currentOnly') detail.append(backupDiffElement('p','backup-diff-note','가져온 파일에 없는 항목입니다. 현재 자료를 그대로 유지합니다. 이름 변경이나 이동도 이렇게 표시될 수 있습니다.'));
    if (record.status==='added') detail.append(backupDiffElement('p','backup-diff-note','현재 경로에 없는 항목입니다. 새 상위 항목이 필요하면 함께 생성합니다. 이름 변경이나 이동은 자동 추정하지 않습니다.'));
    if (record.kind==='menu' && record.incoming?.children?.length) {
      const branch=backupDiffElement('button','backup-diff-branch','이 항목과 하위 항목 선택');branch.type='button';
      branch.addEventListener('click',()=>{const prefix=record.incomingPath.join('.')+'.';records.forEach(child=>{if (child.id===record.id || child.kind==='menu' && child.incomingPath?.join('.').startsWith(prefix)) if (canApplyBackupRecord(child,mode)) selected.add(child.id);});renderList();});detail.append(branch);
    }
    appendBackupTextDiff(detail,record.current,record.incoming);
    appendBackupTableDiff(detail,record.current,record.incoming);appendBackupImageDiff(detail,record.current,record.incoming);
    detail.scrollTop=0;
  }
  function renderList() {
    const visible=visibleRecords();list.replaceChildren();
    if (!visible.length) list.append(backupDiffElement('p','backup-import-empty','해당하는 항목이 없습니다.'));
    const fragment=document.createDocumentFragment();
    visible.forEach(record=>{
      const row=backupDiffElement('div','backup-diff-row');row.dataset.id=record.id;
      row.classList.toggle('active',active?.id===record.id);
      const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=selected.has(record.id);checkbox.disabled=!canApplyBackupRecord(record,mode);checkbox.dataset.recordId=record.id;
      checkbox.setAttribute('aria-label',record.breadcrumb.join(' / ')+' 반영');
      checkbox.addEventListener('change',()=>{if(checkbox.checked)selected.add(record.id);else selected.delete(record.id);updateCount();showDetail(record);});
      const button=backupDiffElement('button','backup-diff-row-title');button.type='button';button.setAttribute('aria-pressed',String(active?.id===record.id));
      button.append(backupDiffElement('span','backup-diff-breadcrumb',record.breadcrumb.slice(0,-1).join(' / ') || (record.kind==='global'?'전역 매뉴얼':'본문')),
        backupDiffElement('span','',record.breadcrumb.at(-1)),backupDiffBadge(record.status));
      button.addEventListener('click',()=>showDetail(record));row.append(checkbox,button);fragment.append(row);
    });
    list.append(fragment);updateCount();
  }
  filter.addEventListener('change',renderList);search.addEventListener('input',renderList);
  selectVisible.addEventListener('click',()=>{visibleRecords().forEach(record=>{if(canApplyBackupRecord(record,mode))selected.add(record.id);});renderList();});
  clear.addEventListener('click',()=>{selected.clear();renderList();});
  method.addEventListener('change',()=>{mode=method.value;records.forEach(record=>{if(!canApplyBackupRecord(record,mode))selected.delete(record.id);});renderList();});
  apply.addEventListener('click',()=>{
    if (storageKey!==activeStorageKey || snapshot!==JSON.stringify(manualData)) {alert('현재 자료가 비교 중 변경되었습니다. 백업을 다시 열어 비교해주세요.');return;}
    if (storedSnapshot!==localStorage.getItem(storageKey)) {
      blockManualStorageWrites(storageKey);
      alert('다른 창에서 저장된 자료가 비교 중 변경되었습니다. 현재 화면의 내용을 파일로 내보낸 뒤 페이지를 새로고침해 다시 비교해주세요.');return;
    }
    const previous=manualData,history={undoStack:[...editHistoryState.undoStack],currentSnapshot:editHistoryState.currentSnapshot};
    const viewport=captureAccordionViewport(),openPaths=getOpenItemPaths();
    try {
      const merged=mergeBackupComparison(manualData,backupData,records,selected,mode);
      if (!merged.applied) return;
      manualData=merged.data;
      // Preserve customized guides and missing current items; reuse existing normalizers.
      ensureSystemSections();normalizeAllTables();ensureGlobalTabs();
      if (!saveToLocalStorage(true)) throw new Error('저장 공간 또는 브라우저 저장 권한을 확인해주세요.');
    } catch (error) {
      manualData=previous;editHistoryState.undoStack=history.undoStack;editHistoryState.currentSnapshot=history.currentSnapshot;
      alert('적용하지 못해 현재 자료를 유지했습니다. '+error.message);return;
    }
    closeBackupImportModal();renderAll();reopenExistingPaths(openPaths,false);highlightCurrentSearchResult();restoreAccordionViewport(viewport);
    alert('선택한 '+selected.size+'개 항목을 반영했습니다. 현재에만 있는 항목과 선택하지 않은 내용은 유지했습니다.');
  });
  dialog.append(header,intro,summary,controls,workspace,backupDiffElement('p','backup-diff-help','선택은 항목별로 적용됩니다. 필요한 참조·사전도 함께 선택하세요. 이름 변경·이동은 자동으로 연결하지 않습니다.'),footer);
  modal.append(dialog);document.body.append(modal);
  modal.addEventListener('cancel',event=>{event.preventDefault();closeBackupImportModal();});
  modal.addEventListener('click',event=>{if(event.target!==modal)return;const rect=modal.getBoundingClientRect();if(event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom)closeBackupImportModal();});
  modal.showModal();renderList();if(active)showDetail(active);else detail.append(backupDiffElement('p','backup-import-empty','비교할 항목이 없습니다.'));
  filter.focus({preventScroll:true});
}
