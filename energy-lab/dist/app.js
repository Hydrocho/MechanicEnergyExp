(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const physics = { gravity: 9.8, mass: 1 };
  const FLOOR = 428, SCALE = 17.2, NS = 'http://www.w3.org/2000/svg';
  let mode = 'free', phase = 'ready', height = 100, velocity = 0, elapsed = 0;
  let initialHeight = 100, startHeight = 100, launchSpeed = 0, selectedSpeed = 10, frame = 0, lastTime = null, dragging = null;
  let isHoldingCharge = false, chargeStartTime = 0, chargeAnimFrame = null;
  const history = [];
  const GHOST_INTERVAL=.3;
  let reviewSamples=[], panX=0, panY=0, reviewDrag=null, reviewing=false;
  let impactSample=null;
  // Optional callbacks installed by game.js. Without them the lab behaves as before.
  const hooks={};
  const call=(name,...args)=>typeof hooks[name]==='function'?hooks[name](...args):undefined;
  const dragMax=()=>call('dragMax')||MAX_SPEED;
  function finishMotion() {
    // Save the incoming speed at contact, independently of frame timing.
    impactSample={h:0,t:elapsed,speed:mode==='coaster'?coaster.flatSpeed:Math.sqrt(launchSpeed**2+2*physics.gravity*startHeight)};
    phase='landed';velocity=0;history.length=0;if(mode==='coaster')coasterCamera=0;
    collectReviewSamples();
    call('finished',info());
  }
  function canReview(){return phase==='landed'||phase==='paused';}
  // Use elapsed time rather than velocity: impact resets velocity to zero.
  function reviewingDescent(){return mode==='throw' && (phase==='landed'||elapsed>launchSpeed/physics.gravity+1e-9);}
  function collectReviewSamples(){
    reviewSamples=[];
    for(let i=0;i<Math.ceil(elapsed/GHOST_INTERVAL-1e-9);i++){
      const t=i*GHOST_INTERVAL;
      if(mode==='throw'){
        const apexTime=launchSpeed/physics.gravity;
        if(reviewingDescent()?t<=apexTime+1e-9:t>apexTime+1e-9)continue;
      }
      const p=mode==='coaster'?coaster.at(t):{x:0,h:Math.max(0,startHeight+launchSpeed*t-.5*physics.gravity*t*t)};
      reviewSamples.push({x:p.x,h:p.h,t,speed:mode==='coaster'?p.speed:Math.abs(launchSpeed-physics.gravity*t)});
    }
  }
  function panReview(dx,dy) {
    reviewing=true;
    if(mode==='coaster')panX=Math.max(-100,Math.min(coasterPosition.x*COASTER_SCALE+100,panX+dx));
    const scale=mode==='coaster'?COASTER_SCALE:SCALE;
    const base=mode==='coaster'?coasterCamera:cameraOffset(height);
    // Bounds are world heights relative to the paused camera, not a fixed
    // pixel offset. Keep both the launch and highest recorded ghost reachable.
    const peak=Math.max(height,...reviewSamples.map(sample=>sample.h));
    const lower=-base*scale-20;
    const upper=Math.max(0,(peak-base-10)*scale);
    panY=Math.max(lower,Math.min(upper,panY+dy));
    render();
    if(dx!==0||dy!==0)autoSelectReview();
  }
  function restoreReview(){selectedSample=null;panX=panY=0;reviewing=false;render();}
  let selectedSample=null, visibleGhosts=[];
  function selectSample(sample){selectedSample=sample;render();}
  function autoSelectReview(){
    if(!canReview()||!reviewing)return;
    // Scan along the direction of travel so flat coaster sections work too.
    const center=mode==='coaster'?320:mode==='throw'?298:276;
    const candidates=visibleGhosts.filter(g=>g.gx>=75&&g.gx<=560&&g.gy>=76&&g.gy<=(mode==='throw'?520:476)).map(g=>({...g,distance:Math.abs((mode==='coaster'?g.gx:g.gy)-center)}));
    const nearest=candidates.reduce((best,g)=>!best||g.distance<best.distance?g:best,null);
    if(!nearest||nearest.distance>90)return;
    const current=candidates.find(g=>g.sample===selectedSample);
    // A small margin avoids flickering between neighbors at the midpoint.
    if(current&&current.distance<=nearest.distance+5)return;
    if(nearest.sample!==selectedSample)selectSample(nearest.sample);
  }
  function updateEnergy(){
    const sample=selectedSample||(phase==='landed'?impactSample:null)||{h:height,speed:Math.abs(velocity),t:elapsed};
    const potential=physics.mass*physics.gravity*sample.h;
    const kinetic=.5*physics.mass*sample.speed**2;
    const total=potential+kinetic;
    const initial=physics.mass*(mode==='throw'?.5*selectedSpeed**2:physics.gravity*startHeight);
    const ceiling=Math.max(initial,total,1e-9);
    const percent=value=>`${Math.max(0,Math.min(100,100*value/ceiling))}%`;
    $('potentialBar').style.height=percent(potential);$('kineticBar').style.height=percent(kinetic);
    $('totalPotentialBar').style.height=percent(potential);$('totalKineticBar').style.height=percent(kinetic);$('totalKineticBar').style.bottom=percent(potential);
    const format=value=>`${value.toLocaleString('ko-KR',{minimumFractionDigits:2,maximumFractionDigits:2})} J`;
    $('potentialValue').textContent=format(potential);$('kineticValue').textContent=format(kinetic);$('totalValue').textContent=format(total);
    $('energyContext').textContent=`${selectedSample?'선택한 잔상':phase==='landed'?'충돌 직전':'현재 상태'} · ${sample.t.toFixed(2)} s`;
    $('energySnapshot').textContent=`높이 ${sample.h.toFixed(2)} m · 속력 ${sample.speed.toFixed(2)} m/s`;
    $('energyLive').hidden=!selectedSample;
    $('energyLive').textContent=phase==='landed'?'충돌 직전 값으로':'현재 값으로';
    $('energyScale').textContent=`막대 전체 높이: ${format(ceiling)}`;
    $('energyImpact').textContent=phase==='landed'&&!selectedSample?'그래프는 충돌 직전 값입니다. 충돌 후 에너지는 열·소리·변형 등으로 전환됩니다.':'';
    $('energyChart').setAttribute('aria-label',`위치 에너지 ${format(potential)}, 운동 에너지 ${format(kinetic)}, 역학적 에너지 ${format(total)}`);
  }
  function updateInstruction(){
    const custom=call('instruction',phase);
    if(custom){$('instruction').textContent=custom;return;}
    const directionLabel=mode==='throw'?(reviewingDescent()?'↓ 하강 잔상 · ':'↑ 상승 잔상 · '):'';
    $('instruction').textContent=canReview()?directionLabel+'드래그하면 중앙 기준선 가까이의 잔상이 자동 선택됩니다. 잔상 간격은 0.3초입니다.':mode==='throw'?'공을 아래로 당겼다 놓으세요. 초기 속력을 입력해 시작할 수도 있어요.':mode==='coaster'?'마지막 언덕을 내려와 평지에서 3초 이동한 뒤 벽에 부딪혀 멈춥니다.':'초기 높이를 정하고 실험을 시작하세요.';
  }
  let coasterHeight=30, coaster=null, coasterPosition={x:0,h:30,slope:-.45,speed:0};
  const COASTER_SCALE=10; // Same distance scale at every starting height.
  let coasterCamera=0;
  function buildCoaster() {
    coaster=new CoasterMotion(coasterHeight,physics.gravity);
    coasterPosition=coaster.at(0);
    coasterCamera=Math.max(0,coasterHeight-30);
  }
  function drawCoaster() {
    let ballY=FLOOR-(height-coasterCamera)*COASTER_SCALE;
    if(!canReview() && ballY<128)coasterCamera=height-(FLOOR-128)/COASTER_SCALE;
    if(!canReview() && ballY>350)coasterCamera=Math.max(0,height-(FLOOR-350)/COASTER_SCALE);
    const scale=COASTER_SCALE, position=coasterPosition.x-panX/COASTER_SCALE;
    const sx=x=>320+(x-position)*scale;
    const sy=h=>FLOOR-(h-coasterCamera)*scale+panY;
    const left=Math.max(0,position-260/scale),right=Math.max(left,Math.min(position+260/scale,coaster.collisionX));
    const nodes=[],points=[],groundY=sy(0)+12;
    // Render only the visible window: an infinite track never grows the DOM.
    nodes.push(svgElement('rect',{x:60,transform:`translate(${-position*scale%10} 0)`,y:groundY,width:540,height:13,fill:'url(#hatch)'}));
    nodes.push(svgElement('line',{x1:60,x2:600,y1:groundY,y2:groundY,stroke:'#8c96a4','stroke-width':1.5}));
    for(let x=Math.ceil(left/9)*9;x<=right;x+=9){
      const p=coaster.profile(x), y=sy(p.h)+15;
      if(y<groundY-5)nodes.push(svgElement('path',{d:`M${sx(x)} ${y}V${groundY} M${sx(x)-8} ${groundY}H${sx(x)+8}`,fill:'none',stroke:'#d0d6df','stroke-width':1.5}));
    }
    function contact(x){const p=coaster.profile(x),norm=Math.hypot(1,p.slope);return [sx(x)+12*p.slope/norm,sy(p.h)+12/norm];}
    const steps=Math.max(1,Math.ceil((right-left)*scale/3));
    for(let i=0;i<=steps;i++)points.push(contact(left+(right-left)*i/steps));
    const path=points.map(([x,y],i)=>`${i?'L':'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
    nodes.push(svgElement('path',{d:path,transform:'translate(0 5)',fill:'none',stroke:'#b1bbc9','stroke-width':1.5}));
    for(let x=Math.ceil(left/1.2)*1.2;x<=right;x+=1.2){const [px,py]=contact(x);nodes.push(svgElement('line',{x1:px,x2:px,y1:py,y2:py+5,stroke:'#a4afbe'}));}
    nodes.push(svgElement('path',{d:path,fill:'none',stroke:'#343c48','stroke-width':2.5}));
    for(const [x,h,text] of [[0,1,'출발'],[3.5,.55,'언덕 1'],[6.3,.3,'언덕 2']]){
      const px=sx(x*coasterHeight);
      if(px<60||px>550)continue;
      const label=svgElement('text',{x:px+15,y:sy(h*coasterHeight)+42,class:'diagram-label'});
      label.textContent=`${text} · ${(h*coasterHeight).toFixed(1)} m`;nodes.push(label);
    }
    const wallX=sx(coaster.collisionX)+12;
    if(wallX>=50 && wallX<=600){
      nodes.push(svgElement('rect',{x:wallX,y:groundY-65,width:16,height:65,fill:'#e3e7ec',stroke:'#343c48','stroke-width':2}));
      for(let row=1;row<5;row++)nodes.push(svgElement('line',{x1:wallX,x2:wallX+16,y1:groundY-row*13,y2:groundY-row*13,stroke:'#a2adbb'}));
      const label=svgElement('text',{x:wallX+23,y:groundY-35,class:'diagram-label'});label.textContent='벽';nodes.push(label);
    }
    const marker=call('marker');
    if(marker?.coasterU!==undefined){
      const mx=marker.coasterU*coasterHeight,top=sy(coaster.profile(mx).h),px=sx(mx);
      if(px>=60&&px<=600){
        nodes.push(svgElement('line',{x1:px,x2:px,y1:top+12,y2:top-62,class:'marker-pole'}));
        nodes.push(svgElement('path',{d:`M${px} ${top-62}L${px+22} ${top-55}L${px} ${top-48}Z`,class:'marker-flag'}));
        const label=svgElement('text',{x:px+26,y:top-52,class:'marker-label'});label.textContent=marker.label;nodes.push(label);
      }
    }
    $('coasterScene').replaceChildren(...nodes);
    return sy(height);
  }
  function svgElement(name, attrs) { const node = document.createElementNS(NS, name); for (const [key,value] of Object.entries(attrs)) node.setAttribute(key,value); return node; }
  const MAX_HEIGHT = 500, MAX_SPEED = 98.99;
  // Keep the original metres-to-pixels scale; follow the ball above 10 m.
  // The ground remains fixed near landing, so contact stays easy to read.
  function cameraOffset(h) { return Math.max(0, h - 10); }
  function drawRuler(offset) {
    const bottomY=mode==='free'?476:510;
    const nodes = [svgElement('line', {x1:147,x2:147,y1:76,y2:Math.min(bottomY,FLOOR+offset*SCALE),stroke:'#d6dce4'})];
    const bottom = Math.max(0, Math.ceil((offset + (FLOOR-bottomY)/SCALE)/5)*5);
    const top = offset + (FLOOR-76)/SCALE;
    for (let metres=bottom; metres<=top; metres+=5) {
      const y=FLOOR-(metres-offset)*SCALE;
      nodes.push(svgElement('line',{x1:139,x2:147,y1:y,y2:y,stroke:'#aab2bf'}));
      const text=svgElement('text',{x:127,y:y+5,'text-anchor':'end',class:'diagram-label'});
      text.textContent=metres; nodes.push(text);
    }
    $('ruler').replaceChildren(...nodes);
  }
  function starPath(cx,cy,r){
    const points=[];for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r*.45:r;points.push(`${(cx+rr*Math.cos(a)).toFixed(1)} ${(cy+rr*Math.sin(a)).toFixed(1)}`);}
    return 'M'+points.join('L')+'Z';
  }
  function drawGameMarker(screenY){
    const marker=mode==='coaster'?null:call('marker'),nodes=[];let offTop=0;
    for(const line of marker?.lines||[]){
      const y=screenY(line.h),goal=line.kind==='goal';
      if(y<84){
        // Off the top of the view: point to it instead of hiding it.
        const text=svgElement('text',{x:335,y:98+18*offTop++,class:goal?'marker-label':'marker-label actual'});
        text.textContent=`↑ ${line.label}`;nodes.push(text);continue;
      }
      nodes.push(svgElement('line',{x1:160,x2:480,y1:y,y2:y,class:goal?'marker-line':'marker-line actual'}));
      if(goal)nodes.push(svgElement('path',{d:starPath(320,y,13),class:'marker-star'}));
      const text=svgElement('text',{x:goal?345:475,y:y-8,'text-anchor':goal?'start':'end',class:goal?'marker-label':'marker-label actual'});
      text.textContent=line.label;nodes.push(text);
    }
    $('gameMarkers').replaceChildren(...nodes);
  }
  function state() { return {mode,phase,height,velocity,elapsed,...physics}; }
  function render() {
    const offset=cameraOffset(height)+panY/SCALE;
    const screenY = h => FLOOR-(h-offset)*SCALE;
    const isCoaster=mode==='coaster';
    const y=isCoaster?drawCoaster():screenY(height);
    $('verticalScene').setAttribute('visibility',isCoaster?'hidden':'visible');
    $('axisTitle').setAttribute('visibility',isCoaster?'hidden':'visible');
    $('coasterScene').setAttribute('visibility',isCoaster?'visible':'hidden');

    drawRuler(offset);
    drawGameMarker(screenY);
    $('ground').setAttribute('transform',`translate(0 ${offset*SCALE})`);
    const ballX=isCoaster?320+panX:320;
    ['ball','ballHit','ballCenter'].forEach(id=>{$(id).setAttribute('cy',y);$(id).setAttribute('cx',ballX);});
    $('heightReadout').innerHTML=`${height.toFixed(2)} <small>m</small>`;
    $('speedReadout').innerHTML=`${Math.abs(velocity).toFixed(2)} <small>m/s</small>`;
    $('timeReadout').innerHTML=`${elapsed.toFixed(2)} <small>s</small>`;
    const aim=mode==='throw' && (phase==='ready'||phase==='aiming') && call('canDrag')!==false;
    // During a drag, preview the selected initial velocity. Otherwise show
    // the actual velocity, including zero before release and after landing.
    const preview=phase==='aiming';
    const shownVelocity=preview?selectedSpeed:velocity;
    const speed=Math.abs(shownVelocity);
    const maximumSpeed=preview?dragMax():mode!=='throw'
      ? Math.sqrt(2*physics.gravity*startHeight) : selectedSpeed;
    const length=48*speed/Math.max(maximumSpeed,.5);
    const direction=shownVelocity>=0?-1:1;
    const norm=isCoaster?Math.hypot(1,coasterPosition.slope):1;
    const dx=isCoaster?1/norm:0, dy=isCoaster?-coasterPosition.slope/norm:direction;
    const tip=y+dy*length, tipX=ballX+dx*length;
    const visible=speed>=.005;
    const head=Math.min(6,length*.4);
    $('launchArrow').setAttribute('visibility',visible?'visible':'hidden');
    $('velocityHead').setAttribute('visibility',visible?'visible':'hidden');
    $('launchArrow').setAttribute('x1',ballX);
    $('launchArrow').setAttribute('x2',tipX);
    $('launchArrow').setAttribute('y1',y);
    $('launchArrow').setAttribute('y2',tip);
    $('launchArrow').setAttribute('stroke-dasharray',preview?'5 4':'none');
    $('velocityHead').setAttribute('d',`M${tipX-dx*head-dy*head} ${tip-dy*head+dx*head} L${tipX} ${tip} L${tipX-dx*head+dy*head} ${tip-dy*head-dx*head}`);
    $('speedLabel').setAttribute('x',ballX+24);
    $('speedLabel').setAttribute('visibility',ballX>=75&&ballX<=530&&y>=90&&y<=460?'visible':'hidden');
    $('speedLabel').setAttribute('y',y-15);
    $('speedLabel').textContent=`${preview?'초기 속력 ':''}${speed.toFixed(2)} m/s`;
    $('dragHint').setAttribute('visibility',aim?'visible':'hidden');
    $('ballControl').classList.toggle('draggable',aim);
    $('status').textContent=phase==='landed'?(isCoaster?'벽 충돌 · 정지':'바닥에 도착'):phase==='aiming'?'속력 설정':phase==='paused'?'일시 정지':phase==='running'?(isCoaster?(coasterPosition.slope<-.01?'내리막':coasterPosition.slope>.01?'오르막':'수평 구간'):velocity>0.05?'올라가는 중':velocity<-.05?'떨어지는 중':'최고점'):'준비';
    const startButton=call('startButton',phase);
    $('start').disabled=!!startButton?.disabled;
    $('start').innerHTML=startButton?startButton.html:phase==='running'?'일시 정지 <span>Ⅱ</span>':phase==='paused'?'계속하기 <span>▷</span>':phase==='landed'?'다시 실험 <span>↗</span>':'실험 시작 <span>↗</span>';
    $('height').disabled=['running','paused','aiming'].includes(phase)||call('inputLocked')===true;
    $('initialLine').setAttribute('visibility',mode==='free'?'visible':'hidden');
    $('initialLine').setAttribute('y1',screenY(startHeight));$('initialLine').setAttribute('y2',screenY(startHeight));
    $('trails').setAttribute('visibility',canReview()?'hidden':'visible');
    $('trails').replaceChildren(...history.map((h,i)=>svgElement('circle',{cx:320,cy:screenY(h),r:3,opacity:(i+1)/history.length*.4})));
    $('scene').classList.toggle('reviewable',canReview());
    $('reviewHome').textContent=phase==='paused'?'공 위치':'도착 위치';
    $('reviewHome').hidden=!(canReview()&&reviewing);
    const guideY=mode==='throw'?298:276;
    $('reviewCenter').setAttribute('visibility',canReview()&&reviewing?'visible':'hidden');
    $('reviewCenter').setAttribute('d',mode==='coaster'?'M320 80V476':`M280 ${guideY}H420`);
    $('reviewGhosts').classList.toggle('revealed',canReview()&&reviewing);
    const ghosts=[];visibleGhosts=[];
    if(canReview())for(const p of reviewSamples){
      const gx=isCoaster?320+(p.x-coasterPosition.x)*COASTER_SCALE+panX:320;
      const gy=isCoaster?FLOOR-(p.h-coasterCamera)*COASTER_SCALE+panY:screenY(p.h);
      if(gx<63||gx>572||gy<64||gy>522)continue;
      const ghost=svgElement('circle',{cx:gx,cy:gy,r:12,fill:'#e5edfc',stroke:'#6385bd','stroke-width':1.5,class:`selectable-ghost${selectedSample===p?' selected-ghost':''}`,role:'button',tabindex:reviewing?'0':'-1','aria-label':`${p.t.toFixed(1)}초 잔상, 속력 ${p.speed.toFixed(2)} m/s`,'aria-pressed':selectedSample===p});
      visibleGhosts.push({gx,gy,sample:p});
      ghost.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();selectSample(p);}});
      const title=svgElement('title',{});title.textContent=`${p.t.toFixed(1)} s`;ghost.append(title);ghosts.push(ghost);
      const label=svgElement('text',{x:gx+18,y:gy+5,class:'ghost-speed'});
      label.textContent=`${p.speed.toFixed(2)} m/s`;ghosts.push(label);
    }
    $('reviewGhosts').replaceChildren(...ghosts);
    if ($('chargeControlCol')) {
      const showCharge = (phase === 'ready' || phase === 'aiming') && call('canDrag') !== false;
      $('chargeControlCol').hidden = !showCharge;
      if (showCharge) {
        if ($('chargeBtn')) $('chargeBtn').disabled = false;
        if (!isHoldingCharge) {
          if ($('chargeTitle')) $('chargeTitle').textContent = mode === 'throw' ? '속도 조절' : '높이 조절';
          if ($('chargeMainText')) $('chargeMainText').innerHTML = mode === 'throw' ? '꾹 누르면<br>속력 조절' : '꾹 누르면<br>높이 조절';
          if ($('chargeSubText')) $('chargeSubText').textContent = mode === 'throw' ? '떼면 발사!' : '떼면 시작!';
          if ($('chargeIcon')) $('chargeIcon').textContent = mode === 'throw' ? '⚡' : (mode === 'coaster' ? '🎢' : '📏');
          if ($('chargeVal')) {
            if (call('isSensorySetup') === true && mode !== 'throw') {
              $('chargeVal').textContent = '??? m';
            } else if (mode === 'throw') {
              $('chargeVal').textContent = `${selectedSpeed.toFixed(2)} m/s`;
            } else if (mode === 'coaster') {
              $('chargeVal').textContent = `${coasterHeight.toFixed(1)} m`;
            } else {
              $('chargeVal').textContent = `${initialHeight.toFixed(1)} m`;
            }
          }
        }
      }
    }
    updateInstruction();
    updateEnergy();
    document.dispatchEvent(new CustomEvent('experiment:update' ,{detail:state()}));
  }
  function stopChargeLoop() {
    if (chargeAnimFrame) {
      cancelAnimationFrame(chargeAnimFrame);
      chargeAnimFrame = null;
    }
    isHoldingCharge = false;
    const btn = $('chargeBtn');
    if (btn) {
      btn.classList.remove('holding');
      if ($('chargeMeterFill')) $('chargeMeterFill').style.height = '0%';
      if ($('chargeMainText')) $('chargeMainText').innerHTML = mode === 'throw' ? '꾹 누르면<br>속력 조절' : '꾹 누르면<br>높이 조절';
      if ($('chargeSubText')) $('chargeSubText').textContent = mode === 'throw' ? '떼면 발사!' : '떼면 시작!';
    }
  }
  function reset() { stopChargeLoop(); cancelAnimationFrame(frame);impactSample=null;selectedSample=null;reviewSamples=[];panX=panY=0;reviewing=false;reviewDrag=null;$('scene').classList.remove('reviewing'); dragging=null; $('ballControl').classList.remove('dragging');phase='ready';elapsed=0;velocity=0;lastTime=null;history.length=0;startHeight=mode==='free'?initialHeight:mode==='coaster'?coasterHeight:0;height=startHeight;if(mode==='coaster')buildCoaster();$('error').textContent='';render(); }
  function setMode(next) {
    stopChargeLoop();clearHeightNotice();mode=next;
    const isThrow=mode==='throw';
    $('ballControl').setAttribute('aria-label',isThrow?'공을 아래로 당기거나 오른쪽 버튼을 꾹 눌러 속력을 조절한 뒤 떼면 발사됩니다.':mode==='coaster'?'궤도 위의 공':'낙하하는 공');
    $('scene').setAttribute('viewBox',isThrow?'0 44 600 490':'0 44 600 440');
    $('worldBounds').setAttribute('height',isThrow?444:400);
    for(const name of ['free','throw','coaster'])$(name+'Tab').setAttribute('aria-pressed',mode===name);
    $('sceneLabel').textContent=mode==='free'?'EXPERIMENT 01':isThrow?'EXPERIMENT 02':'EXPERIMENT 03';
    $('inputLabel').innerHTML=isThrow?'초기 속력 <span>v₀</span>':'초기 높이 <span>h₀</span>';
    $('unit').textContent=isThrow?'m/s':'m';
    $('height').step=isThrow?'.01':'.5';$('height').min=isThrow?'.5':'1';
    $('height').max=String(isThrow?MAX_SPEED:MAX_HEIGHT);
    $('rangeNote').textContent=isThrow?'0.5–98.99 m/s':'1–500 m';
    $('height').value=isThrow?selectedSpeed:mode==='free'?initialHeight:coasterHeight;
    $('instruction').textContent=isThrow?'공을 아래로 당기거나 오른쪽 속도 조절 버튼을 꾹 누르고 계시면 발사할 수 있어요.':mode==='coaster'?'마지막 언덕을 내려와 평지에서 3초 이동한 뒤 벽에 부딪혀 멈춥니다.':'초기 높이를 정하고 실험을 시작하세요.';
    $('physicsNote').textContent=mode==='coaster'?'공기 저항·마찰 없음 · 회전 에너지 제외':'공기 저항 없음';
    reset();
    call('modeChanged',mode);
  }
  let noticeTimer;
  function clearHeightNotice() {
    clearTimeout(noticeTimer);
    $('heightNotice').textContent='';
    $('sceneLabel').style.visibility='visible';
  }
  function showHeightNotice(message) {
    clearTimeout(noticeTimer);
    $('heightNotice').textContent=message;
    $('sceneLabel').style.visibility='hidden';
    noticeTimer=setTimeout(clearHeightNotice,3000);
  }
  function readInput() {
    let n=$('height').valueAsNumber;
    const min=mode==='throw'?.5:1,max=mode==='throw'?MAX_SPEED:MAX_HEIGHT;
    if(mode!=='throw' && Number.isFinite(n) && n>MAX_HEIGHT) {
      const entered=n.toLocaleString('ko-KR',{maximumFractionDigits:10});
      n=MAX_HEIGHT;
      $('height').value=String(n);
      showHeightNotice(`최대 500 m · ${entered} m → 500 m로 조정했어요.`);
    }
    if(!Number.isFinite(n)||n<min||n>max){
      $('error').textContent=`${min} 이상 ${max} 이하의 값을 입력해 주세요.`;
      return false;
    }
    if(mode==='free')initialHeight=n;else if(mode==='coaster')coasterHeight=n;else selectedSpeed=n;
    $('error').textContent='';
    return true;
  }
  function tick(now) {if(phase!=='running')return;if(lastTime!==null)elapsed+=(now-lastTime)/1000;lastTime=now;
    if(mode==='coaster') {
      coasterPosition=coaster.at(elapsed);height=coasterPosition.h;velocity=coasterPosition.speed;
      if(coasterPosition.done){elapsed=coaster.collisionTime;finishMotion();}

      render();if(phase==='running')frame=requestAnimationFrame(tick);return;
    }
    const duration=(launchSpeed+Math.sqrt(launchSpeed**2+2*physics.gravity*startHeight))/physics.gravity;const t=Math.min(elapsed,duration);height=Math.max(0,startHeight+launchSpeed*t-.5*physics.gravity*t*t);velocity=launchSpeed-physics.gravity*t;if(history.length===0||Math.floor(elapsed/.08)>Math.floor((elapsed-(now-tick.previous)/1000)/.08)){history.push(height);if(history.length>8)history.shift();}tick.previous=now;if(elapsed>=duration){elapsed=duration;height=0;finishMotion();}render();if(phase==='running')frame=requestAnimationFrame(tick);}
  function start(fromDrag) {if(call('beforeStart',phase,!!fromDrag)===false){render();return;}if(phase==='running'){phase='paused';cancelAnimationFrame(frame);lastTime=null;collectReviewSamples();render();return;}if(phase==='paused'){selectedSample=null;reviewDrag=null;panX=panY=0;reviewing=false;reviewSamples=[];$('scene').classList.remove('reviewing');phase='running';lastTime=null;render();frame=requestAnimationFrame(tick);return;}if(!readInput())return;call('launched');reset();if(mode==='throw'){startHeight=0;launchSpeed=selectedSpeed;}else launchSpeed=0;velocity=launchSpeed;phase='running';lastTime=null;tick.previous=performance.now();frame=requestAnimationFrame(tick);render();}
  $('freeTab').onclick=()=>{if(mode!=='free'){setMode('free');}};$('throwTab').onclick=()=>setMode('throw');$('coasterTab').onclick=()=>setMode('coaster');$('start').onclick=()=>start();$('reset').onclick=()=>{if(mode==='free')readInput();reset();};$('height').addEventListener('change',()=>{if(readInput()){reset();syncVertSlider();}});
  $('height').addEventListener('input',()=>{clearHeightNotice();syncVertSlider();});
  const syncVertSlider = () => {
    const slider = $('vertSlider');
    if (!slider) return;
    const val = mode === 'throw' ? selectedSpeed : (mode === 'coaster' ? coasterHeight : initialHeight);
    slider.value = String(val);
    call('vertSliderChanged', val);
  };
  const syncFromVertSlider = () => {
    const slider = $('vertSlider');
    if (!slider) return;
    const val = slider.value;
    $('height').value = val;
    clearHeightNotice();
    readInput();
    call('vertSliderChanged', Number(val));
  };
  $('vertSlider')?.addEventListener('input', syncFromVertSlider);
  $('vertSlider')?.addEventListener('change', syncFromVertSlider);
  function point(event){return new DOMPoint(event.clientX,event.clientY).matrixTransform($('scene').getScreenCTM().inverse());}
  $('ballControl').addEventListener('pointerdown',event=>{if(mode!=='throw'||phase!=='ready'||event.button!==0||call('canDrag')===false)return;event.preventDefault();reset();dragging={id:event.pointerId,y:point(event).y,moved:false};$('ballControl').setPointerCapture(event.pointerId);$('ballControl').classList.add('dragging');phase='aiming';selectedSpeed=.5;render();});
  $('ballControl').addEventListener('pointermove',event=>{if(!dragging||dragging.id!==event.pointerId)return;const distance=Math.max(0,point(event).y-dragging.y);dragging.moved=distance>3;selectedSpeed=Math.min(dragMax(),Math.max(.5,distance/(call('dragDistance')||100)*dragMax()));$('height').value=selectedSpeed.toFixed(2);syncVertSlider();render();});
  $('ballControl').addEventListener('pointerup',event=>{if(!dragging||dragging.id!==event.pointerId)return;const fire=dragging.moved;dragging=null;$('ballControl').classList.remove('dragging');$('ballControl').releasePointerCapture(event.pointerId);phase='ready';$('height').value=selectedSpeed.toFixed(2);syncVertSlider();if(fire)start(true);else render();});
  $('ballControl').addEventListener('pointercancel',()=>reset());$('ballControl').addEventListener('lostpointercapture',()=>{if(dragging)reset();});
  
  function startChargeLoop() {
    function updateChargeLoop(now) {
      if (!isHoldingCharge) {
        stopChargeLoop();
        return;
      }
      const elapsedSec = (now - chargeStartTime) / 1000;
      const period = 2.4;
      const factor = 0.5 - 0.5 * Math.cos((2 * Math.PI * elapsedSec) / period);

      if (mode === 'throw') {
        const minVal = 0.5;
        const maxVal = dragMax();
        selectedSpeed = minVal + (maxVal - minVal) * factor;
        selectedSpeed = Math.round(selectedSpeed * 100) / 100;
        $('height').value = selectedSpeed.toFixed(2);
        if ($('chargeVal')) $('chargeVal').textContent = `${selectedSpeed.toFixed(2)} m/s`;
      } else if (mode === 'coaster') {
        const minVal = 1;
        const maxVal = 100;
        coasterHeight = minVal + (maxVal - minVal) * factor;
        coasterHeight = Math.round(coasterHeight * 10) / 10;
        height = coasterHeight;
        startHeight = coasterHeight;
        $('height').value = coasterHeight.toFixed(1);
        if ($('chargeVal')) {
          const isSensory = (call('isSensorySetup') === true);
          $('chargeVal').textContent = isSensory ? '??? m' : `${coasterHeight.toFixed(1)} m`;
        }
      } else {
        const minVal = 1;
        const maxVal = MAX_HEIGHT;
        initialHeight = minVal + (maxVal - minVal) * factor;
        initialHeight = Math.round(initialHeight * 10) / 10;
        height = initialHeight;
        startHeight = initialHeight;
        $('height').value = initialHeight.toFixed(1);
        if ($('chargeVal')) {
          const isSensory = (call('isSensorySetup') === true);
          $('chargeVal').textContent = isSensory ? '??? m' : `${initialHeight.toFixed(1)} m`;
        }
      }

      if ($('chargeMeterFill')) $('chargeMeterFill').style.height = `${(factor * 100).toFixed(1)}%`;
      if ($('chargeMainText')) {
        $('chargeMainText').innerHTML = mode === 'throw' ? '속력 조절 중!<br>손 떼면 발사' : '높이 조절 중!<br>손 떼면 시작';
      }
      if ($('chargeSubText')) $('chargeSubText').textContent = mode === 'throw' ? '원하는 속도에!' : '원하는 높이에!';

      syncVertSlider();
      render();

      chargeAnimFrame = requestAnimationFrame(updateChargeLoop);
    }
    chargeAnimFrame = requestAnimationFrame(updateChargeLoop);
  }

  const chargeBtn = $('chargeBtn');
  if (chargeBtn) {
    chargeBtn.addEventListener('pointerdown', event => {
      if ((phase !== 'ready' && phase !== 'aiming') || event.button !== 0 || call('canDrag') === false) return;
      event.preventDefault();
      reset();
      phase = 'aiming';
      isHoldingCharge = true;
      chargeStartTime = performance.now();
      chargeBtn.classList.add('holding');
      try { chargeBtn.setPointerCapture(event.pointerId); } catch(e){}
      startChargeLoop();
    });

    const endCharge = event => {
      if (!isHoldingCharge) return;
      stopChargeLoop();
      try { if (chargeBtn.hasPointerCapture(event.pointerId)) chargeBtn.releasePointerCapture(event.pointerId); } catch(e){}
      phase = 'ready';
      if (mode === 'throw') {
        $('height').value = selectedSpeed.toFixed(2);
      } else if (mode === 'coaster') {
        $('height').value = coasterHeight.toFixed(1);
      } else {
        $('height').value = initialHeight.toFixed(1);
      }
      syncVertSlider();
      start(true);
    };

    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => {
      chargeBtn.addEventListener(type, endCharge);
    });
  }
  $('energyLive').onclick=()=>{selectedSample=null;render();};
  $('mass').addEventListener('input',()=>{
    const mass=$('mass').valueAsNumber;
    if(!Number.isFinite(mass)||mass<.1||mass>100){$('massError').textContent='질량은 0.1–100 kg으로 입력해 주세요.';return;}
    $('massError').textContent='';physics.mass=mass;updateEnergy();
  });
  $('reviewHome').onclick=restoreReview;
  $('scene').addEventListener('pointerdown',event=>{
    if(!canReview()||event.button!==0||reviewDrag)return;
    event.preventDefault();const p=point(event);
    const candidate=reviewing?visibleGhosts.map(g=>({...g,d:Math.hypot(g.gx-p.x,g.gy-p.y)})).filter(g=>g.d<=20).sort((a,b)=>a.d-b.d)[0]:null;
    reviewDrag={id:event.pointerId,x:p.x,y:p.y,startX:p.x,startY:p.y,moved:false,candidate:candidate?.sample};
    $('scene').setPointerCapture(event.pointerId);$('scene').classList.add('reviewing');panReview(0,0);
  });
  $('scene').addEventListener('pointermove',event=>{
    if(!reviewDrag||reviewDrag.id!==event.pointerId)return;
    const p=point(event);
    if(!reviewDrag.moved&&Math.hypot(p.x-reviewDrag.startX,p.y-reviewDrag.startY)<5)return;
    reviewDrag.moved=true;panReview(p.x-reviewDrag.x,p.y-reviewDrag.y);reviewDrag.x=p.x;reviewDrag.y=p.y;
  });
  function endReviewDrag(event){
    if(!reviewDrag||reviewDrag.id!==event.pointerId)return;
    const sample=event.type==='pointerup'&&!reviewDrag.moved?reviewDrag.candidate:null;
    reviewDrag=null;$('scene').classList.remove('reviewing');
    if($('scene').hasPointerCapture(event.pointerId))$('scene').releasePointerCapture(event.pointerId);
    if(sample)selectSample(sample);
  }
  for(const type of ['pointerup','pointercancel','lostpointercapture'])$('scene').addEventListener(type,endReviewDrag);
  $('scene').addEventListener('keydown',event=>{
    if(!canReview())return;
    const moves={ArrowLeft:[-100,0],ArrowRight:[100,0],ArrowUp:[0,-100],ArrowDown:[0,100]};
    if(event.key==='Home'){event.preventDefault();restoreReview();}else if(moves[event.key]){event.preventDefault();panReview(...moves[event.key]);}
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&phase==='running')start();});
  const context=document.modelContext;if(context?.registerTool){try{Promise.resolve(context.registerTool({name:'reset_experiment',description:'현재 운동 실험을 초기 상태로 되돌립니다.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false},execute(input){if(!input||typeof input!=='object'||Object.keys(input).length)throw new Error('빈 객체를 입력하세요.');reset();return state();}})).catch(()=>{});}catch{}}
  function info(){return {mode,phase,startHeight,launchSpeed,selectedSpeed,mass:physics.mass,gravity:physics.gravity};}
  // Small surface for game.js: read results and drive rounds without touching physics.
  globalThis.EnergyLab={hooks,info,render,reset,setMode,
    setMass(value){physics.mass=value;$('mass').value=String(value);$('massError').textContent='';updateEnergy();},
    setInput(value){$('height').value=value===''?'':String(value);if(value!=='')readInput();reset();syncVertSlider();},
    syncVertSlider};
  render();
  syncVertSlider();
})();

