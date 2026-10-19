const fs = require('fs');
const path = require('path');
const {loadThemeCatalog} = require('./lib/theme-catalog');

const rootDir = __dirname;
const srcDir = path.join(rootDir, 'src');
const outFile = path.join(rootDir, 'index.html');
const backupFile = path.join(rootDir, 'index_BU.html');

const themeCatalog = loadThemeCatalog(srcDir);
const scriptFiles = [
  'js/00-namespace-open.js',
  'js/10-data-state.js',
  'js/20-storage.js',
  'js/25-dom-utils.js',
  'js/26-motion.js',
  'js/27-reading-preferences.js',
  'js/28-default-guide.js',
  'js/29-theme.js',
  ...themeCatalog.filter(theme=>theme.script).map(theme=>theme.script),
  'js/30-markdown-reference.js',
  'js/50-global-manual.js',
  'js/55-layout-resizer.js',
  'js/56-dictionary.js',
  'js/57-dictionary-resizer.js',
  'js/58-accordion-scroll.js',
  'js/60-accordion-core.js',
  'js/70-accordion-render.js',
  'js/80-search-render.js',
  'js/90-editing.js',
  'js/95-backup-menu.js',
  'js/96-settings.js',
  'js/98-reset-init.js',
  'js/99-namespace-export.js',
];

// 테마 스타일은 공통 스타일 뒤에 합칩니다. 기본 테마의 선택자는 변경하지 않습니다.
const styleFiles = ['styles/main.css',...new Set(themeCatalog.flatMap(theme=>theme.styles))];

function readUtf8(relativePath) {
  return fs.readFileSync(path.join(srcDir, relativePath), 'utf8');
}

// Bundle the pinned font locally so the distributable remains a single offline HTML.
function readStyle(fileName) {
  const source = readUtf8(fileName);
  if (fileName !== 'styles/themes/pixelbeat-font.css') return source;
  const font = fs.readFileSync(path.join(srcDir,'assets/fonts/neodgm.woff2'));
  return source.replace('url("../../assets/fonts/neodgm.woff2")',()=> 'url("data:font/woff2;base64,'+font.toString('base64')+'")');
}
function escapeHtml(source) {
  return source.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function ensureNoScriptClose(source, label) {
  if (source.includes('</script>')) {
    throw new Error(`${label} contains </script>, which would break the inline bundle.`);
  }
}

function indent(source, spaces) {
  const prefix = ' '.repeat(spaces);
  return source
    .replace(/\r\n/g, '\n')
    .replace(/\n$/, '')
    .split('\n')
    .map(line => line ? `${prefix}${line}` : '')
    .join('\n');
}

function backupExistingOutput() {
  if (fs.existsSync(outFile)) {
    fs.copyFileSync(outFile, backupFile);
  }
}

function build() {
  const template = readUtf8('index.template.html');
  for (const placeholder of ['{{STYLE}}', '{{BODY}}', '{{SCRIPT}}']) {
    if (!template.includes(placeholder)) {
      throw new Error(`Template is missing ${placeholder}.`);
    }
  }

  const style = styleFiles.map(readStyle).join('\n');
  const options = themeCatalog.map(theme=>'<label class="theme-option"><input type="radio" name="manual-theme" value="'+escapeHtml(theme.id)+'"'+(theme.id === 'modern' ? ' checked' : '')+'><span class="theme-name">'+escapeHtml(theme.label)+'</span><small class="theme-code">'+escapeHtml(theme.id)+'</small></label>').join('\n        ');
  const metadata = themeCatalog.map(({id,label,aliases=[],motionLockReason=''})=>({id,label,aliases,motionLockReason}));
  const registry = 'const MANUAL_THEMES = Object.freeze('+JSON.stringify(metadata).replace(/</g,'\\u003c')+'.map(theme=>Object.freeze({...theme,aliases:Object.freeze(theme.aliases)})));\n';
  const body = readUtf8(path.join('html', 'body.html'))
    .replace('{{THEME_OPTIONS}}',()=>options)
    .replace('{{PIXELBEAT_FONT_LICENSE}}',()=>escapeHtml(readUtf8('assets/fonts/LICENSE.txt')));
  const scripts = scriptFiles.map(fileName => {
    const source = (fileName === 'js/29-theme.js' ? registry : '') + readUtf8(fileName);
    ensureNoScriptClose(source, fileName);
    return `// ===== ${fileName} =====\n${source.replace(/\r\n/g, '\n').replace(/\n*$/, '\n')}`;
  }).join('\n');

  const output = template
    .replace('{{STYLE}}', () => indent(style, 2))
    .replace('{{BODY}}', () => body.replace(/\r\n/g, '\n').replace(/\n$/, ''))
    .replace('{{SCRIPT}}', () => scripts.replace(/\n$/, ''));

  backupExistingOutput();
  fs.writeFileSync(outFile, output, 'utf8');
  console.log(`Built ${path.relative(rootDir, outFile)} from ${scriptFiles.length} JS modules.`);
}

build();
