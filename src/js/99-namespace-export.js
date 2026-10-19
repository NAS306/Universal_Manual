
UniversalManual.actions = Object.freeze({
  toggleButtonMenu,
  selectStorageKey,
  refreshStorageKeyMenu,
  createStorageKey,
  toggleMode,
  exportBackup,
  importBackup,
  resetLocalStorage,
  moveSearchResult
});

UniversalManual.debug = Object.freeze({
  getManualData: () => manualData,
  getCurrentMode: () => currentMode,
  getActiveStorageKey: () => activeStorageKey
});

Object.assign(root, UniversalManual.actions);
})(window);
