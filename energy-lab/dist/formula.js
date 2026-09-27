(() => {
  'use strict';

  const $ = id => document.getElementById(id);

  const FORMULAS = [
    {
      key: 'potential',
      name: '위치 에너지 (Eₚ)',
      mission: '위치 에너지(Eₚ) 공식을 카드를 눌러 순서대로 완성하세요! (× 생략 가능)',
      shortFormat: '<span class="math-expr">9.8<i>mh</i></span>'
    },
    {
      key: 'kinetic',
      name: '운동 에너지 (Eₖ)',
      mission: '운동 에너지(Eₖ) 공식을 카드를 눌러 순서대로 완성하세요! (× 생략 가능)',
      shortFormat: '<span class="math-expr"><span class="math-frac"><span class="num">1</span><span class="den">2</span></span><i>mv</i><sup>2</sup></span>'
    },
    {
      key: 'mechanical',
      name: '역학적 에너지 (E)',
      mission: '역학적 에너지(E) 공식을 카드를 눌러 순서대로 완성하세요! (× 생략 가능)',
      shortFormat: '<span class="math-expr">9.8<i>mh</i> + <span class="math-frac"><span class="num">1</span><span class="den">2</span></span><i>mv</i><sup>2</sup></span>'
    }
  ];

  let currentFormula = null;
  let selectedTokens = [];
  let isGraded = false;

  const getTodayKey = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const getFormulaStats = () => {
    const todayKey = getTodayKey();
    const defaultStats = () => ({
      date: todayKey,
      solved: 0,
      correct: 0,
      byFormula: {
        potential: { solved: 0, correct: 0 },
        kinetic: { solved: 0, correct: 0 },
        mechanical: { solved: 0, correct: 0 }
      }
    });

    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('energy_formula_daily_stats');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.date === todayKey) {
            if (!parsed.byFormula) {
              parsed.byFormula = {
                potential: { solved: 0, correct: 0 },
                kinetic: { solved: 0, correct: 0 },
                mechanical: { solved: 0, correct: 0 }
              };
            }
            return parsed;
          }
        }
      }
    } catch (e) {}
    return defaultStats();
  };

  const saveFormulaStats = stats => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('energy_formula_daily_stats', JSON.stringify(stats));
      }
    } catch (e) {}
  };

  const recordFormulaResult = (isCorrect, key) => {
    const stats = getFormulaStats();
    stats.solved += 1;
    if (isCorrect) stats.correct += 1;

    if (key && stats.byFormula) {
      if (!stats.byFormula[key]) stats.byFormula[key] = { solved: 0, correct: 0 };
      stats.byFormula[key].solved += 1;
      if (isCorrect) stats.byFormula[key].correct += 1;
    }

    saveFormulaStats(stats);
    return stats;
  };

  const getTokenType = token => {
    if (['½', '9.8'].includes(token)) return 'num';
    if (['×', '+'].includes(token)) return 'op';
    if (['질량 m', '높이 h', '속력 v'].includes(token)) return 'var';
    if (['위치 에너지', '운동 에너지'].includes(token)) return 'energy';
    return 'num';
  };

  function evaluateFormula(key, tokens) {
    const nonOp = tokens.filter(t => t !== '×');

    if (key === 'potential') {
      if (nonOp.length !== 3) return false;
      const count = t => nonOp.filter(x => x === t).length;
      return count('질량 m') === 1 && count('9.8') === 1 && count('높이 h') === 1;
    } else if (key === 'kinetic') {
      if (nonOp.length !== 4) return false;
      const count = t => nonOp.filter(x => x === t).length;
      return count('½') === 1 && count('질량 m') === 1 && count('속력 v') === 2;
    } else if (key === 'mechanical') {
      const plusIndices = [];
      tokens.forEach((t, i) => { if (t === '+') plusIndices.push(i); });
      if (plusIndices.length !== 1) return false;
      const pIdx = plusIndices[0];
      const left = tokens.slice(0, pIdx);
      const right = tokens.slice(pIdx + 1);

      const isPotKin = evaluateFormula('potential', left) && evaluateFormula('kinetic', right);
      const isKinPot = evaluateFormula('kinetic', left) && evaluateFormula('potential', right);
      return isPotKin || isKinPot;
    }
    return false;
  }

  function pickNewQuestion() {
    const randIdx = Math.floor(Math.random() * FORMULAS.length);
    currentFormula = FORMULAS[randIdx];
    selectedTokens = [];
    isGraded = false;

    if ($('quizMission')) $('quizMission').textContent = currentFormula.mission;
    if ($('resultMsg')) $('resultMsg').hidden = true;
    if ($('checkAnswerBtn')) $('checkAnswerBtn').hidden = false;
    if ($('nextQuizBtn')) $('nextQuizBtn').hidden = true;

    renderSlots();
    renderStats();
  }

  const getFormattedTokenHTML = token => {
    if (token === '½') return '<span class="math-frac"><span class="num">1</span><span class="den">2</span></span>';
    if (token === '9.8') return '<span class="math-expr">9.8</span>';
    if (token === '질량 m') return '질량 <i>m</i>';
    if (token === '높이 h') return '높이 <i>h</i>';
    if (token === '속력 v') return '속력 <i>v</i>';
    return token;
  };

  function renderSlots() {
    const slotBox = $('slotBox');
    const placeholder = $('slotPlaceholder');
    if (!slotBox) return;

    if (selectedTokens.length === 0) {
      if (placeholder) placeholder.hidden = false;
      slotBox.querySelectorAll('.chip-item').forEach(el => el.remove());
      return;
    }

    if (placeholder) placeholder.hidden = true;
    slotBox.querySelectorAll('.chip-item').forEach(el => el.remove());

    selectedTokens.forEach((tok, idx) => {
      const chip = document.createElement('div');
      chip.className = `chip-item ${getTokenType(tok)}`;
      chip.innerHTML = getFormattedTokenHTML(tok);
      chip.title = '클릭하면 지워집니다';
      chip.style.cursor = 'pointer';
      chip.addEventListener('click', () => {
        if (isGraded) return;
        selectedTokens.splice(idx, 1);
        renderSlots();
      });
      slotBox.appendChild(chip);
    });
  }

  function checkAnswer() {
    if (isGraded) return;

    if (selectedTokens.length === 0) {
      alert('카드를 눌러 공식을 완성한 후 정답을 확인해 주세요!');
      return;
    }

    isGraded = true;
    const isCorrect = evaluateFormula(currentFormula.key, selectedTokens);

    recordFormulaResult(isCorrect, currentFormula.key);

    const resultMsg = $('resultMsg');
    if (resultMsg) {
      resultMsg.hidden = false;
      if (isCorrect) {
        resultMsg.className = 'result-msg ok';
        resultMsg.innerHTML = `<strong>정답입니다! 🎉</strong> &nbsp;·&nbsp; 정답 : <b>${currentFormula.shortFormat}</b>`;
      } else {
        resultMsg.className = 'result-msg bad';
        resultMsg.innerHTML = `<strong>다시 확인해 보세요! 💡</strong> &nbsp;·&nbsp; 정답 : <b>${currentFormula.shortFormat}</b>`;
      }
    }

    if ($('checkAnswerBtn')) $('checkAnswerBtn').hidden = true;
    if ($('nextQuizBtn')) $('nextQuizBtn').hidden = false;
    renderStats();
  }

  function renderStats() {
    const stats = getFormulaStats();
    const solved = stats.solved || 0;
    const correct = stats.correct || 0;
    const rate = solved > 0 ? Math.round((correct / solved) * 100) : 0;

    const parts = stats.date.split('-');
    if ($('fstatDate')) $('fstatDate').textContent = `${parts[0]}. ${parts[1]}. ${parts[2]}`;
    if ($('fstatSolved')) $('fstatSolved').textContent = `${solved}개`;
    if ($('fstatCorrect')) $('fstatCorrect').textContent = `${correct}개`;
    if ($('fstatRate')) $('fstatRate').textContent = `${rate}%`;

    const formatType = key => {
      const d = stats.byFormula?.[key] || { solved: 0, correct: 0 };
      const r = d.solved > 0 ? Math.round((d.correct / d.solved) * 100) : 0;
      return `${d.correct} / ${d.solved}문제 (${r}%)`;
    };

    if ($('fstatPotential')) $('fstatPotential').textContent = formatType('potential');
    if ($('fstatKinetic')) $('fstatKinetic').textContent = formatType('kinetic');
    if ($('fstatMechanical')) $('fstatMechanical').textContent = formatType('mechanical');
  }

  // Event Listeners
  document.querySelectorAll('.palette-card').forEach(btn => {
    btn.addEventListener('click', () => {
      if (isGraded) return;
      const tok = btn.getAttribute('data-token');
      if (tok) {
        selectedTokens.push(tok);
        renderSlots();
      }
    });
  });

  $('undoBtn')?.addEventListener('click', () => {
    if (isGraded) return;
    selectedTokens.pop();
    renderSlots();
  });

  $('clearBtn')?.addEventListener('click', () => {
    if (isGraded) return;
    selectedTokens = [];
    renderSlots();
  });

  $('checkAnswerBtn')?.addEventListener('click', checkAnswer);
  $('nextQuizBtn')?.addEventListener('click', pickNewQuestion);

  // Initialize
  pickNewQuestion();
})();
