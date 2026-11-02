const test = require('node:test'),assert = require('node:assert/strict'),fs = require('node:fs'),path = require('node:path'),vm = require('node:vm');
function setup(){const s={URL};vm.createContext(s);vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/js/31-readable-links.js'),'utf8'),s);return s;}
test('HTTP URLs retain original labels and query, fragment, unicode and uppercase schemes',()=>{
 const s=setup(),source='HTTPS://Example.test/a?x=1&y=2#part http://example.test/end';
 const matches=s.getReadableUrlMatches(source);
 assert.equal(matches.length,2);assert.equal(matches[0].text,'HTTPS://Example.test/a?x=1&y=2#part');assert.equal(matches[0].href,'https://example.test/a?x=1&y=2#part');
 const unicode='https://example.test/\uac80\uc0c9?q=\uc790\ub3d9\ucc28';assert.equal(s.getReadableUrlMatches(unicode)[0].text,unicode);assert.equal(s.getReadableUrlMatches(unicode)[0].href,new URL(unicode).href);
});
test('sentence punctuation and unmatched closing brackets are excluded while balanced URL brackets survive',()=>{
 const s=setup(),matches=s.getReadableUrlMatches('(https://example.test/a_(b)). [http://[::1]:8080/path], https://example.test/end\u3002');
 assert.deepEqual(Array.from(matches,m=>m.text),['https://example.test/a_(b)','http://[::1]:8080/path','https://example.test/end']);
});
test('unsupported schemes, missing hosts and invalid ports are not converted',()=>{
 const s=setup();
 for(const source of ['javascript:alert(1)','data:text/html,hello','file:///C:/test.txt','mailto:a@example.test','www.example.test','https://','https://example.test:99999/path'])assert.equal(s.getReadableUrlMatches(source).length,0,source);
});
test('matching stops at markup delimiters and repeated calls keep source positions intact',()=>{
 const s=setup(),source='<https://example.test/a> and \u201chttps://example.test/b\u201d';
 for(let i=0;i<3;i++){const matches=s.getReadableUrlMatches(source);assert.equal(matches.length,2);for(const match of matches)assert.equal(source.slice(match.start,match.end),match.text);}
});
