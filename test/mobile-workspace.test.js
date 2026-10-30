const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function setup() {
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/js/59-mobile-workspace.js'),'utf8'),sandbox);
  return sandbox;
}
const touches = (a,b)=>[{identifier:17,clientX:a[0],clientY:a[1]},{identifier:29,clientX:b[0],clientY:b[1]}];
test('two fingers must both cross the swipe threshold, regardless of touch-list order',()=>{
  const s = setup();
  const gesture = s.startMobileSwipe(touches([200,200],[200,280]));
  assert.equal(s.measureMobileSwipe(gesture,touches([150,201],[150,281])),null);
  assert.equal(s.measureMobileSwipe(gesture,touches([110,203],[112,282]).reverse()),1);
  assert.equal(s.measureMobileSwipe(s.startMobileSwipe(touches([100,200],[100,280])),touches([180,200],[180,280])),-1);
});
test('pinch, rotation, vertical movement, extra fingers and changed identifiers never change section',()=>{
  const s = setup();
  const initial = touches([180,200],[180,280]);
  for (const moved of [touches([100,200],[260,280]),touches([180,150],[180,350]),touches([100,280],[180,200]),touches([180,280],[180,360]),[...initial,{identifier:40,clientX:150,clientY:240}],touches([100,200],[100,280]).map(t=>({...t,identifier:t.identifier+1}))]) {
    assert.equal(s.measureMobileSwipe(s.startMobileSwipe(initial),moved),null);
  }
  const rejected = s.startMobileSwipe(initial);
  s.measureMobileSwipe(rejected,touches([180,180],[180,300]));
  assert.equal(s.measureMobileSwipe(rejected,touches([100,200],[100,280])),null,'a pinch cannot turn into navigation later in the same gesture');
});
