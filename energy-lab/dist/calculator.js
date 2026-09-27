// Simple Card Multiplication Calculator: Place value cards to multiply them together.
(() => {
  'use strict';
  const G = 9.8;
  const KINDS = {
    m: { sym: 'm', name: '질량', unit: 'kg', defaultVal: 1 },
    h: { sym: 'h', name: '높이', unit: 'm', defaultVal: 10 },
    v: { sym: 'v', name: '속력', unit: 'm/s', defaultVal: 10 },
    g: { sym: 'g', name: '중력가속도', unit: 'm/s²', defaultVal: 9.8 },
    half: { sym: '½', name: '0.5 계수', unit: '', defaultVal: 0.5 },
    num: { sym: '', name: '숫자', unit: '', defaultVal: 1 },
    E: { sym: 'E', name: '에너지', unit: 'J', defaultVal: 100 }
  };

  function fmt(x) {
    if (x === null || x === undefined || Number.isNaN(x)) return '0';
    if (Math.abs(x) < 1e-9) return '0';
    const r = Math.abs(x) < .01 ? Number(x.toPrecision(2)) : Math.round(x * 100) / 100;
    return String(r).replace('-', '−');
  }

  function getPresets() {
    const labMass = typeof document !== 'undefined' ? parseFloat(document.getElementById('mass')?.value) : 1;
    const labHeight = typeof document !== 'undefined' ? parseFloat(document.getElementById('height')?.value) : 10;

    return [
      { id: 'g', kind: 'g', name: 'g', value: G, unit: 'm/s²', builtin: true },
      { id: 'half', kind: 'half', name: '½', value: 0.5, unit: '', builtin: true },
      { id: 'm', kind: 'm', name: 'm', value: Number.isFinite(labMass) && labMass > 0 ? labMass : 1, unit: 'kg', builtin: true },
      { id: 'h', kind: 'h', name: 'h', value: Number.isFinite(labHeight) && labHeight > 0 ? labHeight : 10, unit: 'm', builtin: true },
      { id: 'v', kind: 'v', name: 'v', value: 10, unit: 'm/s', builtin: true }
    ];
  }

  function solveMultiply(slotCards, cardIndex) {
    if (!slotCards || !slotCards.length) {
      return { ok: false, message: '카드를 1개 이상 계산 구역으로 옮겨 주세요.', lines: [] };
    }

    let total = 1;
    const exprParts = [];
    const numParts = [];
    const details = [];
    let hasM = false, hasG = false, hasH = false, hasV = false, hasHalf = false;

    for (const item of slotCards) {
      const card = typeof item === 'string' ? cardIndex.get(item) : item;
      if (!card) continue;
      const val = card.value ?? 1;
      total *= val;

      if (card.kind === 'm') hasM = true;
      if (card.kind === 'g') hasG = true;
      if (card.kind === 'h') hasH = true;
      if (card.kind === 'v') hasV = true;
      if (card.kind === 'half') hasHalf = true;

      const sym = card.name || KINDS[card.kind]?.sym || '';
      const unit = card.unit || KINDS[card.kind]?.unit || '';
      const valText = unit ? `${fmt(val)} ${unit}` : fmt(val);

      if (sym && sym !== fmt(val)) {
        exprParts.push(`${sym} (${valText})`);
      } else {
        exprParts.push(valText);
      }
      numParts.push(fmt(val));
      details.push({ sym, val, unit });
    }

    // Determine result unit
    let unit = 'J';
    if (slotCards.length === 1) {
      const single = typeof slotCards[0] === 'string' ? cardIndex.get(slotCards[0]) : slotCards[0];
      if (single?.unit) unit = single.unit;
    } else if (!hasM && !hasG && !hasH && !hasV && !hasHalf) {
      unit = '';
    }

    const formattedTotal = `${fmt(total)}${unit ? ' ' + unit : ''}`.trim();
    const formulaStr = exprParts.join(' × ');
    const mathStr = `${numParts.join(' × ')} = ${formattedTotal}`;

    return {
      ok: true,
      lines: [
        `수식: ${formulaStr}`,
        `계산: ${mathStr}`
      ],
      answer: {
        symbol: '결과',
        value: total,
        unit,
        text: `계산 결과 = ${formattedTotal}`
      },
      formulaStr,
      mathStr
    };
  }

  function describe(slotCards, cardIndex) {
    if (!slotCards || !slotCards.length) return '빈 식';
    const names = slotCards.map(id => {
      const c = cardIndex.get(id);
      if (!c) return '';
      const sym = c.name || KINDS[c.kind]?.sym || '';
      return sym ? `${sym}(${fmt(c.value)})` : fmt(c.value);
    }).filter(Boolean);
    const res = solveMultiply(slotCards, cardIndex);
    return `${names.join(' × ')} = ${res.answer?.text || ''}`;
  }

  globalThis.EnergyCalc = { BUILTIN: getPresets(), KINDS, fmt, solveMultiply, describe };

  // ---- Interface ----------------------------------------------------------------
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const $ = id => document.getElementById(id);
  const view = $('calcView'), lab = globalThis.EnergyLab;
  if (!view) return;

  let customCards = [], slotCards = [], nextId = 1, output = null, drag = null, suppressClick = false;

  const getCardIndex = () => {
    const map = new Map();
    for (const c of [...getPresets(), ...customCards]) map.set(c.id, c);
    return map;
  };

  view.innerHTML = `
    <p class="calc-intro">문제 상황에 맞춰 <b>카드를 선택/드래그하여 배치</b>하세요. 모든 카드는 <b>곱하기(×)</b>로 연결됩니다.</p>
    <section class="calc-block" aria-labelledby="calcStep1">
      <h3 id="calcStep1"><span>1</span>값 카드 선택 & 만들기</h3>
      <div class="card-maker">
        <select id="calcKind" aria-label="카드 종류">
          ${Object.entries(KINDS).map(([k, d]) => `<option value="${k}">${d.sym ? d.sym + ' · ' : ''}${d.name}${d.unit ? ` (${d.unit})` : ''}</option>`).join('')}
        </select>
        <div class="input-wrap">
          <input id="calcValue" type="number" min="0" step="any" inputmode="decimal" placeholder="값" aria-label="카드 값">
          <span id="calcUnit">kg</span>
        </div>
        <button type="button" id="calcAdd" class="calc-add">카드 추가</button>
      </div>
      <p id="calcMakerError" class="calc-error" role="alert"></p>
      <div id="calcPalette" class="card-tray" aria-label="카드 목록"></div>
    </section>
    <section class="calc-block" aria-labelledby="calcStep2">
      <h3 id="calcStep2"><span>2</span>계산식 조립 (곱하기 영역)</h3>
      <div id="calcHint" class="calc-hint" aria-live="polite">
        <span>카드를 누르거나 아래 영역으로 끌어다 놓으세요. 카드는 <b>곱하기(×)</b>로 자동 연결됩니다.</span>
      </div>
      <div id="calcEquation" class="equation">
        <div id="multiplyZone" class="eq-row multiply-row" data-zone="multiply"></div>
      </div>
    </section>
    <div class="calc-actions">
      <button type="button" id="calcCheck" class="primary">계산하기 <span aria-hidden="true">=</span></button>
      <button type="button" id="calcClear" class="secondary">식 비우기</button>
    </div>
    <section id="calcOutput" class="calc-output" aria-live="polite"></section>`;

  function chipHTML(card, attrs = {}) {
    const builtin = card.builtin;
    const cls = builtin ? 'chip-const' : card.kind === 'num' ? 'chip-num' : `chip-${card.kind}`;
    const sym = card.name || KINDS[card.kind]?.sym || '';
    const valStr = card.unit ? `${fmt(card.value)} ${card.unit}` : fmt(card.value);
    const body = builtin || card.kind !== 'num' ? `<b>${sym}</b><small>${valStr}</small>` : `<b>${valStr}</b>`;
    const label = `${sym} ${valStr} 카드`;

    const attrStr = Object.entries(attrs).map(([k, v]) => `data-${k}="${v}"`).join(' ');
    return `<button type="button" class="chip ${cls}" data-card="${card.id}" ${attrStr} aria-label="${label}">${body}</button>`;
  }

  function render() {
    const cardMap = getCardIndex();
    const presets = getPresets();

    // Render palette
    const allAvailable = [...presets, ...customCards];
    $('calcPalette').innerHTML = allAvailable.map(c => {
      const chip = chipHTML(c, { from: 'palette', card: c.id });
      return c.builtin ? chip : `<span class="chip-wrap">${chip}<button type="button" class="chip-del" data-del="${c.id}" aria-label="${c.name} 카드 지우기">×</button></span>`;
    }).join('');

    // Render multiply zone
    const zone = $('multiplyZone');
    if (!slotCards.length) {
      zone.innerHTML = `<span class="row-empty">카드를 이곳으로 옮기거나 클릭해 넣어 보세요</span>`;
    } else {
      zone.innerHTML = slotCards.map((id, index) => {
        const c = cardMap.get(id);
        if (!c) return '';
        const chip = chipHTML(c, { from: 'slot', card: id, index });
        return `${index > 0 ? '<span class="times" aria-hidden="true">×</span>' : ''}${chip}`;
      }).join('');
    }

    renderOutput();
  }

  function renderOutput() {
    const box = $('calcOutput');
    if (!output) { box.innerHTML = ''; return; }

    if (output.ok) {
      const steps = output.lines.map(line => {
        const i = line.indexOf(': ');
        if (i === -1) return `<div class="step"><span class="rhs">${line}</span></div>`;
        return `<div class="step"><span class="lhs">${line.slice(0, i)}</span><span class="eqs">=</span><span class="rhs">${line.slice(i + 2)}</span></div>`;
      }).join('');

      box.innerHTML = `
        <div class="calc-msg ok"><strong>계산 완료!</strong> 선택한 카드가 모두 곱셈으로 연결되었습니다.</div>
        <div class="steps">${steps}</div>
        <p class="calc-answer">${output.answer.text}</p>`;
    } else {
      box.innerHTML = `<div class="calc-msg bad"><strong>안내:</strong> ${output.message}</div>`;
    }
  }

  function updateMaker() {
    const kind = $('calcKind').value;
    const kindInfo = KINDS[kind];
    $('calcUnit').textContent = kindInfo.unit || '배';
    if (!$('calcValue').value) {
      $('calcValue').placeholder = String(kindInfo.defaultVal ?? '값');
    }
  }

  function addCard() {
    const kind = $('calcKind').value;
    const error = $('calcMakerError');
    let value = $('calcValue').valueAsNumber;

    if (!Number.isFinite(value)) {
      value = KINDS[kind].defaultVal ?? 1;
    }

    if (value <= 0 && kind !== 'num') {
      error.textContent = '0보다 큰 값을 입력해 주세요.';
      return;
    }
    error.textContent = '';

    const newId = 'u' + nextId++;
    customCards.push({
      id: newId,
      kind,
      name: KINDS[kind].sym || '숫자',
      value,
      unit: KINDS[kind].unit || ''
    });

    $('calcValue').value = '';
    output = null;
    render();
  }

  function deleteCard(id) {
    customCards = customCards.filter(c => c.id !== id);
    slotCards = slotCards.filter(x => x !== id);
    output = null;
    render();
  }

  function addToSlot(id) {
    slotCards.push(id);
    output = null;
    render();
  }

  function removeFromSlot(index) {
    slotCards.splice(index, 1);
    output = null;
    render();
  }

  // Pointer dragging and clicks
  view.addEventListener('click', event => {
    if (suppressClick) { suppressClick = false; return; }
    const t = event.target;
    if (t.closest('#calcAdd')) return addCard();
    if (t.closest('#calcCheck')) {
      output = solveMultiply(slotCards, getCardIndex());
      render();
      return;
    }
    if (t.closest('#calcClear')) {
      slotCards = [];
      output = null;
      render();
      return;
    }

    const del = t.closest('[data-del]');
    if (del) return deleteCard(del.dataset.del);

    const chip = t.closest('[data-card]');
    if (chip) {
      const d = chip.dataset;
      if (d.from === 'palette') {
        addToSlot(d.card);
      } else if (d.from === 'slot') {
        removeFromSlot(+d.index);
      }
    }
  });

  view.addEventListener('change', event => {
    if (event.target.id === 'calcKind') updateMaker();
  });

  view.addEventListener('keydown', event => {
    if (event.target.id === 'calcValue' && event.key === 'Enter') {
      event.preventDefault();
      addCard();
    }
  });

  // Dragging support
  function endDrag() {
    if (!drag) return;
    drag.ghost?.remove();
    drag.over?.classList.remove('drop-over');
    view.classList.remove('dragging');
    drag = null;
  }

  view.addEventListener('pointerdown', event => {
    const chip = event.target.closest('[data-card]');
    if (!chip || event.button !== 0) return;
    drag = {
      pid: event.pointerId,
      chip,
      cardId: chip.dataset.card,
      from: chip.dataset.from,
      index: chip.dataset.index !== undefined ? +chip.dataset.index : null,
      x: event.clientX,
      y: event.clientY,
      moved: false
    };
  });

  document.addEventListener('pointermove', event => {
    if (!drag || drag.pid !== event.pointerId) return;
    if (!drag.moved) {
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 6) return;
      drag.moved = true;
      drag.ghost = drag.chip.cloneNode(true);
      drag.ghost.classList.add('chip-ghost');
      drag.ghost.removeAttribute('data-card');
      document.body.append(drag.ghost);
      view.classList.add('dragging');
      try { drag.chip.setPointerCapture(event.pointerId); } catch {}
    }
    event.preventDefault();
    drag.ghost.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
    const over = document.elementFromPoint(event.clientX, event.clientY)?.closest('#multiplyZone');
    if (over !== drag.over) {
      drag.over?.classList.remove('drop-over');
      over?.classList.add('drop-over');
      drag.over = over;
    }
  });

  document.addEventListener('pointerup', event => {
    if (!drag || drag.pid !== event.pointerId) return;
    if (drag.moved) {
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 0);
      const over = document.elementFromPoint(event.clientX, event.clientY)?.closest('#multiplyZone');
      const cardId = drag.cardId;
      const from = drag.from;
      const index = drag.index;
      endDrag();

      if (over) {
        if (from === 'palette') {
          addToSlot(cardId);
        }
      } else {
        if (from === 'slot' && index !== null) {
          removeFromSlot(index);
        }
      }
      return;
    }
    endDrag();
  });

  document.addEventListener('pointercancel', endDrag);

  // ---- Tabs and game connection -----------------------------------------------------
  function showTab(name) {
    const calc = name === 'calc';
    $('energyTabBtn').setAttribute('aria-selected', String(!calc));
    $('calcTabBtn').setAttribute('aria-selected', String(calc));
    $('energyTabBtn').tabIndex = calc ? -1 : 0;
    $('calcTabBtn').tabIndex = calc ? 0 : -1;
    $('energyView').hidden = calc;
    view.hidden = !calc;
  }

  $('energyTabBtn')?.addEventListener('click', () => showTab('energy'));
  $('calcTabBtn')?.addEventListener('click', () => showTab('calc'));

  for (const id of ['energyTabBtn', 'calcTabBtn']) {
    $(id)?.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const next = id === 'energyTabBtn' ? 'calc' : 'energy';
      showTab(next);
      $(next === 'calc' ? 'calcTabBtn' : 'energyTabBtn').focus();
    });
  }

  if (lab) {
    lab.calculator = {
      showTab,
      refresh: render,
      newProblem() {
        slotCards = [];
        output = null;
        render();
      },
      snapshot() {
        if (!slotCards.length) return null;
        const res = solveMultiply(slotCards, getCardIndex());
        return {
          equation: res.formulaStr + ' = ' + (res.answer?.text || ''),
          ok: res.ok,
          detail: res.answer?.text || ''
        };
      }
    };
  }

  updateMaker();
  render();
})();
