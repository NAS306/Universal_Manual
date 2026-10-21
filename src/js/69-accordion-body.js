// Only presentation state lives here. Headers/paths remain eagerly available.
const accordionBodyState = new WeakMap();
function registerAccordionBody(contentDiv,item,path) {
  accordionBodyState.set(contentDiv,{item,path,mode:null});
}
function createAccordionBody(item,path) {
  const contentDiv = document.createDocumentFragment();
  const contentText = item.content || '';
  const itemImages = ensureItemImages(item);
  const hasVisibleContent = contentText.trim().length > 0;
  const hasVisibleImages = itemImages.length > 0;

  if (hasVisibleContent || hasVisibleImages || currentMode === 'edit' || item.content) {
    const pre = document.createElement('pre');
    if (currentMode === 'edit') {
      pre.contentEditable = "true";
      pre.dataset.imageEditor = 'true';
      pre.dataset.dictionaryEnabled = String(!isReferenceSection(manualData.menu[path[0]]) && !isDictionaryPath(path));
      const images = itemImages;
      renderContentWithImages(pre, contentText, images, true);
      pre.addEventListener('click', (e) => e.stopPropagation());
      pre.addEventListener('pointerdown', (e) => e.stopPropagation());
      const itemEditorContext = createItemImageEditorContext(path);
      pre.addEventListener('input', event => {
        handleImageEditorChange(pre, itemEditorContext, event);
      });
      bindReferenceAutocomplete(pre, () => addItemImage(path, pre));
    } else {
      pre.contentEditable = "false";
      renderContentWithImages(pre, contentText, itemImages);
      if (!isReferenceSection(manualData.menu[path[0]]) && !isDictionaryPath(path)) linkDictionaryTerms(pre);
      if (!hasVisibleContent && !hasVisibleImages) pre.style.display = 'none';
    }
    contentDiv.appendChild(pre);
  }

  ensureItemTables(item).forEach((table, tableIndex) => {
    contentDiv.appendChild(createTableElement(table, path, tableIndex));
  });


  return contentDiv;
}
function ensureAccordionBody(contentDiv) {
  const state = accordionBodyState.get(contentDiv);
  if (!state || state.mode === currentMode) return;
  const fragment = createAccordionBody(state.item,state.path);
  if (state.mode !== null) contentDiv.querySelectorAll(':scope > pre, :scope > .manual-table-wrap').forEach(element=>element.remove());
  contentDiv.prepend(fragment);
  state.mode = currentMode;
}
