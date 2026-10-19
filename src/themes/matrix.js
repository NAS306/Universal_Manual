// Decorative only: no canvas, timers, network, or manual/backup state.
let matrixRainLayer = null;
function syncMatrixRain({motionEnabled, hidden}) {
  const enabled = motionEnabled;
  if (!enabled) {
    matrixRainLayer?.remove();
    matrixRainLayer = null;
    return;
  }
  if (!matrixRainLayer) {
    const layer = document.createElement('div');
    layer.className = 'matrix-rain';
    layer.setAttribute('aria-hidden','true');
    layer.inert = true;
    const alphabet = '012345789ABCDEFGHIJKLMNOPQRSTUVWXYZｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉ';
    // A fixed, bounded set of streams; animation runs on CSS transforms only.
    for (let i=0;i<32;i++) {
      const stream = document.createElement('span');
      stream.className = 'matrix-rain-stream';
      stream.textContent = Array.from({length:20+(i*7)%19},(_,j)=>alphabet[(i*17+j*13+j*j)%alphabet.length]).join('\n');
      stream.style.left = ((i+.3)*100/32)+'%';
      stream.style.setProperty('--rain-duration',(14+(i*7)%17)+'s');
      stream.style.setProperty('--rain-delay',(-((i*11)%31))+'s');
      stream.style.setProperty('--rain-size',(12+i%4)+'px');
      layer.append(stream);
    }
    document.body.prepend(layer);
    matrixRainLayer = layer;
  }
  matrixRainLayer.classList.toggle('is-paused',hidden);
}
function disposeMatrixRain() {
  matrixRainLayer?.remove();
  matrixRainLayer = null;
}
registerManualThemeEffect('matrix', {refresh:syncMatrixRain, dispose:disposeMatrixRain});
