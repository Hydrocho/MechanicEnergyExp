// Game mode regression test for 3-way mode switch (Lab, Quiz, Sensorial Game).
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const elements = new Map(); let frame, state;
function element() { return { style: {}, value: '10', focus() {}, get valueAsNumber() { return this.value === '' ? NaN : Number(this.value); }, setAttribute(k, v) { this[k] = v; }, append(...n) { (this.children ??= []).push(...n); }, replaceChildren(...n) { this.children = n; }, classList: { toggle() {}, add() {}, remove() {} }, addEventListener(k, f) { this[k] = f; }, textContent: '', innerHTML: '' }; }
const get = id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); };
const store = new Map();
const localStorageMock = {
  getItem: k => store.get(k) ?? null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
  clear: () => store.clear()
};
const context = { localStorage: localStorageMock, confirm: () => true, document: { getElementById: get, createElement: element, createElementNS: element, dispatchEvent: e => state = e.detail, addEventListener() {} }, CustomEvent: function (t, o) { this.detail = o.detail; }, requestAnimationFrame: f => (frame = f, 1), cancelAnimationFrame() {}, performance: { now: () => 0 }, setTimeout() {}, clearTimeout() {} };
vm.createContext(context); for (const f of ['coaster.js', 'app.js', 'game.js']) vm.runInContext(fs.readFileSync(new URL('../dist/' + f, 'file:///' + __filename.replaceAll('\\', '/')), 'utf8'), context);
const run = () => { frame(0); frame(1e6); };

// Lab mode is untouched until mode buttons are pressed.
get('mass').value = '3'; get('mass').input();
assert.equal(get('start').disabled, false);

// 1. Quiz Mode test
get('quizModeBtn').click();
assert.equal(get('gameBar').hidden, false); assert.equal(get('energyVeil').hidden, false); assert.equal(get('reset').hidden, true); assert.equal(get('mass').disabled, true);
console.log('PASS: quiz mode switch, concealed energy panel');

// Test running quiz prediction
get('newQuestionBtn').click();
assert.equal(state.phase, 'ready');
get('prediction').value = '200';
get('start').onclick(); run();
assert.equal(state.phase, 'landed');
assert.match(get('missionResult').innerHTML, /내 답/);
console.log('PASS: quiz mode answer entry and grading');

// 2. Sensorial Game Mode test
get('gameModeBtn').click();
assert.equal(get('gameBar').hidden, true); assert.equal(get('sensoryGameBar').hidden, false); assert.equal(get('reset').hidden, true);
assert.equal(get('settingsBlock').hidden, true);

// Verify height slider visibility logic: visible ONLY in game mode for free fall & coaster
get('freeTab').onclick();
assert.equal(get('vertSliderCol').hidden, false);
assert.equal(get('vertSliderVal').textContent, '??? m');

get('coasterTab').onclick();
assert.equal(get('vertSliderCol').hidden, false);

get('throwTab').onclick();
assert.equal(get('vertSliderCol').hidden, true);

get('freeTab').onclick();
get('start').onclick(); run();
assert.equal(state.phase, 'landed');
assert.match(get('sensoryResultText').innerHTML, /목표|실제/);
assert.match(get('vertSliderVal').textContent, /m/);
console.log('PASS: sensorial physics game launch and reveal grading');

// Test stats button and stats modal popup
get('statsBtn').click();
assert.equal(get('statsModal').hidden, false);
assert.match(get('statsSolved').textContent, /1개/);
get('statsCloseBtn').click();
assert.equal(get('statsModal').hidden, true);
console.log('PASS: today stats modal and local storage recording');

// 3. Leaving modes restores the lab.
get('labModeBtn').click();
assert.equal(get('gameBar').hidden, true); assert.equal(get('sensoryGameBar').hidden, true); assert.equal(get('reset').hidden, false); assert.equal(get('mass').disabled, false); assert.equal(get('mass').value, '3');
assert.equal(get('vertSliderCol').hidden, true);
console.log('PASS: return to lab restores mass and controls');

// Regression: loading game hooks must not disable ordinary lab drag launching.
context.DOMPoint=function(x,y){this.matrixTransform=()=>({x,y});};
get('scene').getScreenCTM=()=>({inverse:()=>({})});
get('ballControl').setPointerCapture=()=>{};get('ballControl').releasePointerCapture=()=>{};
function dragLaunch(){
  const e=y=>({button:0,pointerId:7,clientX:320,clientY:y,preventDefault(){}});
  get('ballControl').pointerdown(e(428));assert.equal(state.phase,'aiming');
  get('ballControl').pointermove(e(478));assert(Number(get('height').value)>0);
  get('ballControl').pointerup(e(478));assert.equal(state.phase,'running');assert(state.velocity>0);
}
get('throwTab').onclick();assert.equal(context.EnergyLab.hooks.canDrag(),true);dragLaunch();run();
get('gameModeBtn').click();assert.equal(context.EnergyLab.hooks.canDrag(),true);dragLaunch();assert.equal(context.EnergyLab.hooks.canDrag(),false);run();assert.equal(context.EnergyLab.hooks.canDrag(),false);
get('labModeBtn').click();assert.equal(context.EnergyLab.hooks.canDrag(),true);dragLaunch();
console.log('PASS: pointer drag launches in lab, game setup and return to lab; game running/graded guards retained');
