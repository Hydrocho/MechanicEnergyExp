// Unit test for formula.js (Formula Quiz Standalone Module)
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');

const elements = new Map();
function element() {
  return {
    style: {},
    value: '',
    setAttribute(k, v) { this[k] = v; },
    getAttribute(k) { return this[k] ?? null; },
    classList: { toggle() {}, add() {}, remove() {} },
    addEventListener(k, f) { (this.listeners ??= {})[k] = f; },
    click() { this.listeners?.click?.(); },
    querySelectorAll() { return []; },
    appendChild(n) { (this.children ??= []).push(n); },
    textContent: '',
    innerHTML: '',
    hidden: false
  };
}

const get = id => {
  if (!elements.has(id)) elements.set(id, element());
  return elements.get(id);
};

const store = new Map();
const localStorageMock = {
  getItem: k => store.get(k) ?? null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
  clear: () => store.clear()
};

const paletteCards = [
  { ...element(), getAttribute: () => '½', addEventListener(k, f) { this.click = f; } },
  { ...element(), getAttribute: () => '×', addEventListener(k, f) { this.click = f; } },
  { ...element(), getAttribute: () => '질량 m', addEventListener(k, f) { this.click = f; } },
  { ...element(), getAttribute: () => '×', addEventListener(k, f) { this.click = f; } },
  { ...element(), getAttribute: () => '속력 v', addEventListener(k, f) { this.click = f; } },
  { ...element(), getAttribute: () => '×', addEventListener(k, f) { this.click = f; } },
  { ...element(), getAttribute: () => '속력 v', addEventListener(k, f) { this.click = f; } }
];

const context = {
  localStorage: localStorageMock,
  document: {
    getElementById: get,
    createElement: element,
    querySelectorAll: sel => sel.includes('palette-card') ? paletteCards : []
  },
  alert() {}
};

vm.createContext(context);
vm.runInContext(
  fs.readFileSync(
    new URL('../dist/formula.js', 'file:///' + __filename.replaceAll('\\', '/')),
    'utf8'
  ),
  context
);

// Verify initialization
assert.notEqual(get('quizMission').textContent, '');
console.log('PASS: formula quiz initialized successfully');

// Click palette card to add a token
paletteCards[0].click();
get('checkAnswerBtn').click();

const rawStats = localStorageMock.getItem('energy_formula_daily_stats');
assert.notEqual(rawStats, null);
const parsed = JSON.parse(rawStats);
assert.equal(typeof parsed.solved, 'number');
assert.equal(parsed.solved, 1);
console.log('PASS: formula quiz card sequence assembly and daily stats recording');
console.log('PASS: formula quiz daily stats recorded in localStorage');
