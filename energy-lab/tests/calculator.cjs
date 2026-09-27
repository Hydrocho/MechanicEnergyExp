// Card multiplication calculator unit tests.
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const context = {}; vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL('../dist/calculator.js', 'file:///' + __filename.replaceAll('\\', '/')), 'utf8'), context);
const C = context.EnergyCalc;

const cardIndex = new Map(C.BUILTIN.map(c => [c.id, c]));

// Test empty slots
{
  const res = C.solveMultiply([], cardIndex);
  assert.equal(res.ok, false);
  assert.match(res.message, /카드를 1개 이상/);
}
console.log('PASS: empty slots check');

// Test Potential Energy: m=1kg, g=9.8m/s², h=10m => 98 J
{
  const res = C.solveMultiply(['m', 'g', 'h'], cardIndex);
  assert.equal(res.ok, true);
  assert.equal(res.answer.value, 98);
  assert.equal(res.answer.unit, 'J');
  assert.equal(res.answer.text, '계산 결과 = 98 J');
}
console.log('PASS: potential energy m * g * h');

// Test Kinetic Energy: ½ * m=1kg * v=10m/s * v=10m/s => 50 J
{
  const res = C.solveMultiply(['half', 'm', 'v', 'v'], cardIndex);
  assert.equal(res.ok, true);
  assert.equal(res.answer.value, 50);
  assert.equal(res.answer.unit, 'J');
  assert.equal(res.answer.text, '계산 결과 = 50 J');
}
console.log('PASS: kinetic energy ½ * m * v * v');

// Test custom numbers multiplication
{
  const customMap = new Map([
    ['num1', { id: 'num1', kind: 'num', name: '숫자', value: 3, unit: '' }],
    ['num2', { id: 'num2', kind: 'num', name: '숫자', value: 4, unit: '' }]
  ]);
  const res = C.solveMultiply(['num1', 'num2'], customMap);
  assert.equal(res.ok, true);
  assert.equal(res.answer.value, 12);
}
console.log('PASS: custom card multiplication');

