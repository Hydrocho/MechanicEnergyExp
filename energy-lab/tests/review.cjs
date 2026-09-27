const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const elements=new Map();let frame,state;
function element(){return {style:{},value:'10',get valueAsNumber(){return Number(this.value)},setAttribute(k,v){this[k]=v},append(...n){(this.children??=[]).push(...n)},replaceChildren(...n){this.children=n},classList:{toggle(){},add(){},remove(){}},addEventListener(k,f){this[k]=f},textContent:''};}
const get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id)};
const context={document:{getElementById:get,createElement:element,createElementNS:element,dispatchEvent:e=>state=e.detail,addEventListener(){}},CustomEvent:function(t,o){this.detail=o.detail},requestAnimationFrame:f=>(frame=f,1),cancelAnimationFrame(){},performance:{now:()=>0},setTimeout(){},clearTimeout(){}};
vm.createContext(context);for(const f of ['coaster.js','app.js'])vm.runInContext(fs.readFileSync(new URL('../dist/'+f, 'file:///'+__filename.replaceAll('\\','/')),'utf8'),context);
const ghostCircles=()=>get('reviewGhosts').children.filter(g=>g.r===12);
const ghostLabels=()=>get('reviewGhosts').children.filter(g=>g.class==='ghost-speed');
const move=key=>get('scene').keydown({key,preventDefault(){}});
get('throwTab').onclick();get('height').value='63.6';get('height').change();get('start').onclick();frame(0);frame(1580);get('start').onclick();
const paused={...state}, y=get('ball').cy;
for(let i=0;i<100;i++)move('ArrowUp');
const origin=ghostCircles().find(g=>g.children[0].textContent==='0.0 s');
assert(origin && origin.cy>=76 && origin.cy<=510,'Paused ascent must allow reviewing ground-level launch ghost');
assert.equal(get('trails').visibility,'hidden','Moving dots must be hidden during review');
assert.deepEqual({...state},paused,'Review must not change physics');
for(let i=0;i<100;i++)move('ArrowDown');
assert(ghostCircles().some(g=>g.cy>=76&&g.cy<=510),'Upper review limit must retain recorded ghosts');
get('reviewHome').onclick();assert.equal(get('ball').cy,y);get('start').onclick();assert.equal(get('trails').visibility,'visible');frame(10000);assert.equal(state.elapsed,paused.elapsed);frame(30000);assert.equal(state.phase,'landed');move('ArrowDown');assert.equal(get('trails').visibility,'hidden');
get('coasterTab').onclick();get('height').value='500';get('height').change();get('start').onclick();frame(0);frame(2000);get('start').onclick();const saved={...state};for(let i=0;i<100;i++)move('ArrowUp');assert.deepEqual({...state},saved);get('reviewHome').onclick();get('reset').onclick();assert.equal(state.phase,'ready');
console.log('PASS: paused ascent ground access, upper bound, dots hidden, restore/resume, landed and coaster review');


// A 9.8 m/s launch peaks at exactly 1 s; the whole path fits on screen.
function pauseThrow(ms){get('throwTab').onclick();get('height').value='9.8';get('height').change();get('start').onclick();frame(0);frame(ms);if(state.phase==='running')get('start').onclick();}
const ghostTimes=()=>ghostCircles().map(g=>Number(g.children[0].textContent.split(' ')[0]));
pauseThrow(800);assert.deepEqual(ghostTimes(),[0,.3,.6]);assert(get('instruction').textContent.includes('↑ 상승 잔상'));
pauseThrow(1000);assert.deepEqual(ghostTimes(),[0,.3,.6,.9]);assert(get('instruction').textContent.includes('↑ 상승 잔상'));
pauseThrow(1010);assert.deepEqual(ghostTimes(),[]);assert(get('instruction').textContent.includes('↓ 하강 잔상'));
pauseThrow(1700);assert.deepEqual(ghostTimes(),[1.2,1.5]);assert(get('instruction').textContent.includes('↓ 하강 잔상'));
get('start').onclick();frame(9000);frame(9500);assert.equal(state.phase,'landed');assert.deepEqual(ghostTimes(),[1.2,1.5,1.8]);assert(get('instruction').textContent.includes('↓ 하강 잔상'));
get('freeTab').onclick();get('height').value='10';get('height').change();get('start').onclick();frame(0);frame(600);get('start').onclick();assert.deepEqual(ghostTimes(),[0,.3]);assert(!get('instruction').textContent.includes('하강 잔상'));
console.log('PASS: ascent/apex/descent/landing filtering, global 0.3 s timing, resume and mode changes');

assert.deepEqual(ghostLabels().map(n=>n.textContent),['0.00 m/s','2.94 m/s']);
pauseThrow(800);assert.deepEqual(ghostLabels().map(n=>n.textContent),['9.80 m/s','6.86 m/s','3.92 m/s']);
pauseThrow(1700);assert.deepEqual(ghostLabels().map(n=>n.textContent),['1.96 m/s','4.90 m/s']);
const label=ghostLabels()[0],circle=ghostCircles()[0];assert.equal(label.x,circle.cx+18);assert.equal(label.y,circle.cy+5);
move('ArrowDown');ghostLabels().forEach((l,i)=>assert.equal(l.y,ghostCircles()[i].cy+5));
get('coasterTab').onclick();get('height').value='30';get('height').change();get('start').onclick();frame(0);frame(1800);get('start').onclick();
const motion=vm.runInContext('new CoasterMotion(30)',context);
ghostLabels().forEach((l,i)=>assert.equal(l.textContent,motion.at(ghostTimes()[i]).speed.toFixed(2)+' m/s'));
assert(ghostLabels().length>0);get('reset').onclick();assert.equal(ghostLabels().length,0);
console.log('PASS: per-ghost speed values in all modes, unsigned descent speed, label coordinates, pan and reset');


get('freeTab').onclick();get('height').value='10';get('height').change();assert.equal(get('potentialValue').textContent,'98.00 J');assert.equal(get('kineticValue').textContent,'0.00 J');
get('start').onclick();frame(0);frame(600);assert.equal(get('totalValue').textContent,'98.00 J');get('start').onclick();move('ArrowDown');
const chosen=ghostCircles().find(g=>g.children[0].textContent==='0.3 s');assert(chosen);chosen.keydown({key:'Enter',preventDefault(){},stopPropagation(){}});
assert.equal(get('energyContext').textContent,'선택한 잔상 · 0.30 s');assert.equal(get('potentialValue').textContent,'93.68 J');assert.equal(get('kineticValue').textContent,'4.32 J');assert.equal(get('totalValue').textContent,'98.00 J');
get('mass').value='2';get('mass').input();assert.equal(get('totalValue').textContent,'196.00 J');get('energyLive').onclick();assert(get('energyContext').textContent.includes('현재 상태'));get('start').onclick();frame(1000);frame(3000);assert.equal(get('totalValue').textContent,'196.00 J');assert(get('energyContext').textContent.includes('충돌 직전'));assert.equal(state.velocity,0);assert(get('energyImpact').textContent.includes('충돌'));
get('throwTab').onclick();assert(!get('energyContext').textContent.includes('선택'));get('mass').value='0';get('mass').input();assert(get('massError').textContent);get('mass').value='1';get('mass').input();
console.log('PASS: live energies, sample selection, historical values, mass scaling, collision loss, clearing selection');

for(const mode of ['free','throw','coaster']){
  get(mode+'Tab').onclick();get('height').value=mode==='throw'?'9.8':'10';get('height').change();get('start').onclick();frame(0);frame(100000);
  assert.equal(state.phase,'landed');assert.equal(state.velocity,0);
  const expected=mode==='throw'?'48.02 J':'98.00 J';
  assert.equal(get('potentialValue').textContent,'0.00 J');assert.equal(get('kineticValue').textContent,expected);assert.equal(get('totalValue').textContent,expected);assert(get('energyContext').textContent.startsWith('충돌 직전'));
  move('ArrowDown');const ghost=ghostCircles()[0];assert(ghost);ghost.keydown({key:'Enter',preventDefault(){},stopPropagation(){}});assert(get('energyContext').textContent.startsWith('선택한 잔상'));assert.equal(get('energyLive').textContent,'충돌 직전 값으로');get('energyLive').onclick();assert.equal(get('totalValue').textContent,expected);assert(get('energyContext').textContent.startsWith('충돌 직전'));
  get('mass').value='2';get('mass').input();assert.equal(get('totalValue').textContent,mode==='throw'?'96.04 J':'196.00 J');get('mass').value='1';get('mass').input();
  get('reset').onclick();assert(get('energyContext').textContent.startsWith('현재 상태'));assert.equal(get('kineticValue').textContent,'0.00 J');assert.equal(get('energyImpact').textContent,'');
}
console.log('PASS: all 3 pre-impact snapshots, stopped physics, sample override/return, mass recalculation, reset');

for(const mode of ['free','throw','coaster']){
  get(mode+'Tab').onclick();get('height').value=mode==='throw'?'30':'30';get('height').change();get('start').onclick();frame(0);frame(100000);
  const stopped={...state};move(mode==='coaster'?'ArrowRight':'ArrowDown');
  assert(get('energyContext').textContent.startsWith('선택한 잔상'),'Pan should select a centered ghost in '+mode);
  assert.equal(get('reviewCenter').visibility,'visible');
  const first=get('energyContext').textContent;
  for(let i=0;i<4;i++)move(mode==='coaster'?'ArrowRight':'ArrowDown');
  assert.notEqual(get('energyContext').textContent,first,'Selection should follow pan in '+mode);
  assert.deepEqual({...state},stopped,'Automatic selection must preserve stopped physics');
  const manual=ghostCircles()[0];assert(manual);manual.keydown({key:'Enter',preventDefault(){},stopPropagation(){}});assert(get('energyContext').textContent.includes(Number(manual.children[0].textContent.split(' ')[0]).toFixed(2)+' s'));
  get('reviewHome').onclick();assert(get('energyContext').textContent.startsWith('충돌 직전'));assert.equal(get('reviewCenter').visibility,'hidden');
}
console.log('PASS: automatic centered selection in all modes, continuous pan updates, manual override, fixed physics and return');
