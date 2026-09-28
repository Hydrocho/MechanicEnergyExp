// Mode Controller: 🧪 실험 (Lab), 📝 퀴즈 (Quiz), 🎮 게임 (Sensorial Game)
(() => {
  'use strict';
  const lab = globalThis.EnergyLab;
  if (!lab) return;
  const $ = id => document.getElementById(id);
  const G = 9.8;

  let appMode = 'lab'; // 'lab', 'quiz', 'game'
  let quizState = 'setup'; // 'setup', 'started', 'graded'
  let sensoryState = 'setup'; // 'setup', 'started', 'graded'
  let quizScoreCount = 0;
  let sensoryScoreCount = 0;
  let currentQuizQuestion = null;
  let currentSensoryQuestion = null;
  let labMass = 1;

  const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const num = (x, d = 2) => (Number.isFinite(x) ? x.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '0');
  const int = x => Math.round(x).toLocaleString('ko-KR');

  // Quiz Question Generator
  function makeQuizQuestion(exp) {
    const mass = randInt(1, 5);
    if (exp === 'throw') {
      const v0 = randInt(10, 30);
      const truth = 0.5 * mass * v0 * v0;
      return {
        exp: 'throw',
        mass,
        setupVal: v0,
        unit: 'J',
        mission: `초기 속력 <b>${v0} m/s</b>로 공을 쏘아 올려요. 최고점에서의 <b>위치 에너지</b>는 몇 J일까요?`,
        given: `질량 ${mass} kg · g = 9.8 m/s²`,
        truth
      };
    } else if (exp === 'coaster') {
      const h = randInt(10, 50);
      const truth = mass * G * h;
      return {
        exp: 'coaster',
        mass,
        setupVal: h,
        unit: 'J',
        mission: `출발 높이 <b>${h} m</b>에서 코스터를 출발시킵니다. 바닥에 도착했을 때의 <b>운동 에너지</b>는 몇 J일까요?`,
        given: `질량 ${mass} kg · g = 9.8 m/s²`,
        truth
      };
    } else {
      const h = randInt(10, 60);
      const truth = mass * G * h;
      return {
        exp: 'free',
        mass,
        setupVal: h,
        unit: 'J',
        mission: `높이 <b>${h} m</b>에서 공을 떨어뜨려요. 바닥에 닿기 직전 <b>운동 에너지</b>는 몇 J일까요?`,
        given: `질량 ${mass} kg · g = 9.8 m/s²`,
        truth
      };
    }
  }

  // Sensorial Game Generator
  function makeSensoryQuestion(exp) {
    const mass = randInt(1, 5);
    if (exp === 'throw') {
      const targetH = randInt(5, 75);
      const targetSpeed = Math.sqrt(2 * G * targetH);
      return {
        exp: 'throw',
        mass,
        targetH,
        targetSpeed,
        mission: `최고점 높이가 <b>${targetH} m</b>가 되도록 공의 초기 속력을 조절하세요!`,
        given: `질량 ${mass} kg · 중력 가속도 g = 9.8 m/s²`
      };
    } else if (exp === 'coaster') {
      const targetSpeed = randInt(8, 42);
      const targetH = (targetSpeed * targetSpeed) / (2 * G);
      return {
        exp: 'coaster',
        mass,
        targetSpeed,
        targetH,
        mission: `바닥에 도착했을 때 속력이 <b>${targetSpeed} m/s</b>가 되도록 출발 높이를 조절하세요!`,
        given: `질량 ${mass} kg · 중력 가속도 g = 9.8 m/s²`
      };
    } else {
      const targetSpeed = randInt(10, 88);
      const targetH = (targetSpeed * targetSpeed) / (2 * G);
      return {
        exp: 'free',
        mass,
        targetSpeed,
        targetH,
        mission: `바닥에 도착했을 때 속력이 <b>${targetSpeed} m/s</b>가 되도록 높이를 조절하세요!`,
        given: `질량 ${mass} kg · 중력 가속도 g = 9.8 m/s²`
      };
    }
  }

  function setupQuizQuestion() {
    const exp = lab.info().mode;
    currentQuizQuestion = makeQuizQuestion(exp);
    quizState = 'setup';
    lab.setMass(currentQuizQuestion.mass);

    if (exp === 'throw') lab.setInput('');
    else lab.setInput(currentQuizQuestion.setupVal);

    if ($('prediction')) $('prediction').value = '';
    update();
    lab.calculator?.newProblem();
  }

  function setupSensoryQuestion() {
    const exp = lab.info().mode;
    currentSensoryQuestion = makeSensoryQuestion(exp);
    sensoryState = 'setup';
    lab.setMass(currentSensoryQuestion.mass);

    if (exp === 'throw') {
      const initV = randInt(10, 40);
      lab.setInput(initV);
    } else {
      const initH = randInt(10, 80);
      lab.setInput(initH);
    }

    update();
  }

  const getTodayKey = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const getDailyQuizStats = () => {
    const todayKey = getTodayKey();
    const defaultStats = () => ({
      date: todayKey,
      solved: 0,
      correct: 0,
      byType: {
        free: { solved: 0, correct: 0 },
        throw: { solved: 0, correct: 0 },
        coaster: { solved: 0, correct: 0 }
      }
    });

    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('energy_quiz_daily_stats');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.date === todayKey) {
            if (!parsed.byType) {
              parsed.byType = {
                free: { solved: 0, correct: 0 },
                throw: { solved: 0, correct: 0 },
                coaster: { solved: 0, correct: 0 }
              };
            }
            return parsed;
          }
        }
      }
    } catch (e) {}
    return defaultStats();
  };

  const getDailyGameStats = () => {
    const todayKey = getTodayKey();
    const defaultStats = () => ({
      date: todayKey,
      solved: 0,
      correct: 0,
      stars: { s3: 0, s2: 0, s1: 0, s0: 0 },
      byType: {
        free: { solved: 0, correct: 0, stars: { s3: 0, s2: 0, s1: 0, s0: 0 } },
        throw: { solved: 0, correct: 0, stars: { s3: 0, s2: 0, s1: 0, s0: 0 } },
        coaster: { solved: 0, correct: 0, stars: { s3: 0, s2: 0, s1: 0, s0: 0 } }
      }
    });

    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('energy_game_daily_stats');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.date === todayKey) {
            if (!parsed.stars) parsed.stars = { s3: 0, s2: 0, s1: 0, s0: 0 };
            if (!parsed.byType) {
              parsed.byType = {
                free: { solved: 0, correct: 0, stars: { s3: 0, s2: 0, s1: 0, s0: 0 } },
                throw: { solved: 0, correct: 0, stars: { s3: 0, s2: 0, s1: 0, s0: 0 } },
                coaster: { solved: 0, correct: 0, stars: { s3: 0, s2: 0, s1: 0, s0: 0 } }
              };
            }
            for (const key of ['free', 'throw', 'coaster']) {
              if (!parsed.byType[key]) parsed.byType[key] = { solved: 0, correct: 0, stars: { s3: 0, s2: 0, s1: 0, s0: 0 } };
              if (!parsed.byType[key].stars) parsed.byType[key].stars = { s3: 0, s2: 0, s1: 0, s0: 0 };
            }
            return parsed;
          }
        }
      }
    } catch (e) {}
    return defaultStats();
  };

  const saveDailyQuizStats = stats => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('energy_quiz_daily_stats', JSON.stringify(stats));
      }
    } catch (e) {}
  };

  const saveDailyGameStats = stats => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('energy_game_daily_stats', JSON.stringify(stats));
      }
    } catch (e) {}
  };

  const recordQuizResult = (isCorrect, exp) => {
    const stats = getDailyQuizStats();
    stats.solved += 1;
    if (isCorrect) stats.correct += 1;

    if (exp && stats.byType) {
      if (!stats.byType[exp]) stats.byType[exp] = { solved: 0, correct: 0 };
      stats.byType[exp].solved += 1;
      if (isCorrect) stats.byType[exp].correct += 1;
    }

    saveDailyQuizStats(stats);
    return stats;
  };

  const recordGameResult = (starRating, exp) => {
    const isSuccess = starRating >= 1;
    const stats = getDailyGameStats();
    stats.solved += 1;
    if (isSuccess) stats.correct += 1;
    const sKey = `s${starRating}`;
    if (!stats.stars) stats.stars = { s3: 0, s2: 0, s1: 0, s0: 0 };
    stats.stars[sKey] = (stats.stars[sKey] || 0) + 1;

    if (exp && stats.byType) {
      if (!stats.byType[exp]) stats.byType[exp] = { solved: 0, correct: 0, stars: { s3: 0, s2: 0, s1: 0, s0: 0 } };
      stats.byType[exp].solved += 1;
      if (isSuccess) stats.byType[exp].correct += 1;
      if (!stats.byType[exp].stars) stats.byType[exp].stars = { s3: 0, s2: 0, s1: 0, s0: 0 };
      stats.byType[exp].stars[sKey] = (stats.byType[exp].stars[sKey] || 0) + 1;
    }

    saveDailyGameStats(stats);
    return stats;
  };

  function gradeQuiz(info) {
    quizState = 'graded';
    const predValue = $('prediction')?.valueAsNumber;
    const hasPred = Number.isFinite(predValue) && predValue > 0;
    const truth = currentQuizQuestion.truth;

    let isCorrect = false;
    let resultHTML = '';

    if (hasPred) {
      const error = Math.abs(predValue - truth) / truth * 100;
      isCorrect = error <= 5;
      const exp = currentQuizQuestion?.exp || lab.info().mode;
      const stats = recordQuizResult(isCorrect, exp);
      quizScoreCount = stats.correct;

      resultHTML = `
        <div class="calc-msg ${isCorrect ? 'ok' : 'bad'}" style="margin-top:8px;padding:8px 12px">
          <strong>${isCorrect ? '정답입니다! 🎉' : '다시 확인해 보세요! 💡'}</strong>
          <span>내 답: <b>${num(predValue)} J</b> · 실제 정답: <b>${int(truth)} J</b> ${isCorrect ? '' : `(오차 ${num(error, 1)}%)`}</span>
        </div>
      `;
    } else {
      resultHTML = `
        <div class="calc-msg" style="margin-top:8px;padding:8px 12px;background:#eef3ff;color:#244b88">
          <strong>실험 관찰 결과! 🔍</strong>
          <span>실제 측정 에너지: <b>${int(truth)} J</b></span>
        </div>
      `;
    }

    if ($('missionResult')) {
      $('missionResult').hidden = false;
      $('missionResult').innerHTML = resultHTML;
    }

    update();
    lab.calculator?.showTab('energy');
  }

  function gradeSensoryGame(info) {
    sensoryState = 'graded';
    const exp = currentSensoryQuestion.exp;

    let targetVal = 0, actualVal = 0, inputVal = 0, targetInput = 0;
    let unit = 'm/s';

    if (exp === 'throw') {
      targetVal = currentSensoryQuestion.targetH;
      const speed = Number.isFinite(info?.selectedSpeed) ? info.selectedSpeed : (Number.isFinite(info?.launchSpeed) ? info.launchSpeed : Number($('height')?.value || 0));
      actualVal = (speed * speed) / (2 * G);
      inputVal = speed;
      targetInput = currentSensoryQuestion.targetSpeed;
      unit = 'm';
    } else {
      targetVal = currentSensoryQuestion.targetSpeed;
      const h = Number.isFinite(info?.startHeight) ? info.startHeight : Number($('height')?.value || 0);
      actualVal = Math.sqrt(2 * G * Math.max(0, h));
      inputVal = h;
      targetInput = currentSensoryQuestion.targetH;
      unit = 'm/s';
    }

    const error = targetVal > 0 ? (Math.abs(actualVal - targetVal) / targetVal * 100) : 0;
    const isSuccess = error <= 25;

    let starRating = 0;
    let stars = '⭐';
    let verdict = '다시 도전해 보세요! 💡';
    if (error <= 8) {
      starRating = 3;
      stars = '⭐⭐⭐';
      verdict = '신의 감각! 완벽합니다! 🎉';
    } else if (error <= 18) {
      starRating = 2;
      stars = '⭐⭐';
      verdict = '훌륭한 물리 직관입니다! 👍';
    } else if (error <= 25) {
      starRating = 1;
      stars = '⭐';
      verdict = '좋은 직관입니다! 통과했어요! 👍';
    } else if (error <= 35) {
      starRating = 0;
      stars = '⭐';
      verdict = '아까워요! 조금만 더 세밀하게 조절해 보세요! 💡';
    } else {
      starRating = 0;
    }

    const stats = recordGameResult(starRating, exp);
    sensoryScoreCount = stats.correct;

    const inputUnit = exp === 'throw' ? 'm/s' : 'm';
    const resultHTML = `
      <div class="calc-msg ${isSuccess ? 'ok' : 'bad'}" style="margin-top:8px;padding:8px 12px">
        <strong>${stars} ${verdict}</strong>
        <span>목표: <b>${num(targetVal, 1)} ${unit}</b> · 실제 측정: <b>${num(actualVal, 1)} ${unit}</b> (오차 ${num(error, 1)}%)</span><br>
        <small style="color:#56677a">내가 조절한 설정: <b>${num(inputVal, 1)} ${inputUnit}</b> (목표 값: <b>${num(targetInput, 1)} ${inputUnit}</b>)</small>
      </div>
    `;

    if ($('sensoryResultText')) {
      $('sensoryResultText').hidden = false;
      $('sensoryResultText').innerHTML = resultHTML;
    }

    update();
  }

  // Hooks into app.js
  lab.game = { level: () => 1 };
  const h = lab.hooks;

  h.dragMax = () => appMode !== 'lab' ? 50 : 0;
  h.dragDistance = () => appMode !== 'lab' ? 150 : 0;
  h.canDrag = () => appMode === 'lab' || (appMode === 'quiz' && quizState === 'setup') || (appMode === 'game' && sensoryState === 'setup');
  h.inputLocked = () => false;

  function updateVertSliderDisplay(val) {
    const exp = lab.info()?.mode || 'free';
    const isHeightGame = (appMode === 'game' && (exp === 'free' || exp === 'coaster'));

    if ($('vertSliderCol')) {
      $('vertSliderCol').hidden = !isHeightGame;
    }

    if (!isHeightGame) return;

    let title = '높이 조절';
    let unit = 'm';
    let maxVal = 500;

    if (exp === 'coaster') {
      title = '출발 높이';
      unit = 'm';
      maxVal = 100;
    }

    const slider = $('vertSlider');
    if (slider) {
      slider.max = String(maxVal);
      if (Number.isFinite(val)) {
        slider.value = String(val);
      }
    }
    if ($('vertSliderTitle')) $('vertSliderTitle').textContent = title;

    if ($('vertSliderVal')) {
      if (sensoryState === 'setup') {
        $('vertSliderVal').textContent = '??? m';
      } else {
        const displayVal = Number.isFinite(val) ? val : Number($('height')?.value || slider?.value || 0);
        $('vertSliderVal').textContent = `${num(displayVal, 1)} ${unit}`;
      }
    }
  }

  h.vertSliderChanged = val => updateVertSliderDisplay(val);

  h.beforeStart = phase => {
    if (appMode === 'lab') return true;
    if (appMode === 'quiz') {
      if (quizState === 'graded') {
        setupQuizQuestion();
        return false;
      }
    } else if (appMode === 'game') {
      if (sensoryState === 'graded') {
        setupSensoryQuestion();
        return false;
      }
    }
    return true;
  };

  h.launched = () => {
    if (appMode === 'quiz' && quizState === 'setup') {
      quizState = 'started';
      update();
    } else if (appMode === 'game' && sensoryState === 'setup') {
      sensoryState = 'started';
      update();
    }
  };

  h.finished = info => {
    if (appMode === 'quiz' && quizState === 'started') gradeQuiz(info);
    else if (appMode === 'game' && sensoryState === 'started') gradeSensoryGame(info);
  };

  h.modeChanged = () => {
    if (appMode === 'quiz') setupQuizQuestion();
    else if (appMode === 'game') setupSensoryQuestion();
    updateVertSliderDisplay();
  };

  h.startButton = phase => {
    if (appMode === 'lab') return null;
    if (appMode === 'quiz') {
      if (quizState === 'graded') return { html: '다음 퀴즈 <span aria-hidden="true">→</span>' };
      return { html: '실험 시작 · 결과 확인 <span aria-hidden="true">↗</span>' };
    }
    if (appMode === 'game') {
      if (sensoryState === 'graded') return { html: '다음 게임 <span aria-hidden="true">➔</span>' };
      return { html: '실험 시작 <span aria-hidden="true">↗</span>' };
    }
    return null;
  };

  h.instruction = phase => {
    if (appMode === 'lab') return null;
    if (appMode === 'quiz' && quizState === 'setup') {
      return '계산기로 정답을 구해서 입력하거나, 공을 직접 조작해 [실험 시작]을 누르세요!';
    }
    if (appMode === 'game' && sensoryState === 'setup') {
      return '우측 세로 슬라이더로 수치를 조절한 뒤 [실험 시작] 버튼을 누르세요!';
    }
    return null;
  };

  h.marker = () => null;

  function update() {
    $('labModeBtn')?.setAttribute('aria-pressed', String(appMode === 'lab'));
    if ($('quizModeBtn')) $('quizModeBtn').setAttribute('aria-pressed', String(appMode === 'quiz'));
    $('gameModeBtn')?.setAttribute('aria-pressed', String(appMode === 'game'));

    $('gameBar').hidden = (appMode !== 'quiz');
    if ($('sensoryGameBar')) $('sensoryGameBar').hidden = (appMode !== 'game');
    if ($('settingsBlock')) $('settingsBlock').hidden = (appMode === 'game');

    $('reset').hidden = (appMode !== 'lab');
    $('mass').disabled = (appMode !== 'lab');

    const concealed = (appMode === 'quiz' && quizState !== 'graded');
    $('energyPanel')?.classList.toggle('concealed', concealed);
    const veil = $('energyVeil');
    if (veil) veil.hidden = !concealed;
    if ($('gameResult')) $('gameResult').hidden = true;

    updateVertSliderDisplay();

    if (appMode === 'lab') {
      lab.render();
      return;
    }

    if (appMode === 'quiz') {
      if ($('scoreLabel')) $('scoreLabel').textContent = `맞힌 퀴즈: ${quizScoreCount}개`;
      if ($('missionText')) $('missionText').innerHTML = currentQuizQuestion?.mission || '';
      if ($('missionGiven')) $('missionGiven').textContent = currentQuizQuestion?.given || '';

      const btn = $('submitAnswerBtn');
      if (btn) {
        if (quizState === 'graded') {
          btn.innerHTML = '다음 퀴즈 ↗';
          btn.style.background = '#287d3c';
          btn.style.borderColor = '#287d3c';
        } else {
          btn.innerHTML = '정답 확인하기 ↗';
          btn.style.background = '#355dce';
          btn.style.borderColor = '#355dce';
        }
      }

      if (quizState === 'setup') {
        if ($('missionResult')) $('missionResult').hidden = true;
        if ($('prediction')) $('prediction').disabled = false;
      } else if (quizState === 'graded') {
        if ($('prediction')) $('prediction').disabled = true;
      }
    } else if (appMode === 'game') {
      if ($('sensoryScoreLabel')) $('sensoryScoreLabel').textContent = `성공한 게임: ${sensoryScoreCount}개`;
      if ($('sensoryMissionText')) $('sensoryMissionText').innerHTML = currentSensoryQuestion?.mission || '';
      if ($('sensoryGivenText')) $('sensoryGivenText').textContent = currentSensoryQuestion?.given || '';

      if (sensoryState === 'setup') {
        if ($('sensoryResultText')) $('sensoryResultText').hidden = true;
      }
    }

    lab.render();
  }

  function setAppMode(newMode) {
    if (newMode === appMode) {
      if (appMode === 'quiz') lab.calculator?.showTab('calc');
      else lab.calculator?.showTab('energy');
      return;
    }

    if (appMode === 'lab') {
      labMass = lab.info().mass;
    }

    appMode = newMode;

    if (appMode === 'quiz') {
      quizScoreCount = getDailyQuizStats().correct;
      setupQuizQuestion();
      lab.calculator?.showTab('calc');
    } else if (appMode === 'game') {
      sensoryScoreCount = getDailyGameStats().correct;
      setupSensoryQuestion();
      lab.calculator?.showTab('energy');
    } else {
      currentQuizQuestion = null;
      currentSensoryQuestion = null;
      lab.setMass(labMass);
      lab.setMode(lab.info().mode);
      update();
      lab.calculator?.refresh();
      lab.calculator?.showTab('energy');
    }
  }

  const showAlertModal = (title, message) => {
    const modal = $('alertModal');
    if (!modal) {
      alert(message.replace(/<[^>]+>/g, ''));
      return;
    }
    if (title) $('modalTitle').textContent = title;
    if (message) $('modalDesc').innerHTML = message;
    modal.hidden = false;
    $('modalCloseBtn')?.focus();
  };

  const closeAlertModal = () => {
    const modal = $('alertModal');
    if (modal) modal.hidden = true;
    $('prediction')?.focus();
  };

  const showStatsModal = () => {
    const modal = $('statsModal');
    if (!modal) return;
    const isGame = (appMode === 'game');

    if ($('quizStatsView')) $('quizStatsView').hidden = isGame;
    if ($('gameStatsView')) $('gameStatsView').hidden = !isGame;

    if ($('statsIcon')) $('statsIcon').textContent = isGame ? '🎮' : '📝';
    if ($('statsTitle')) $('statsTitle').textContent = isGame ? '오늘의 게임 성과' : '오늘의 퀴즈 통계';

    if (!isGame) {
      const stats = getDailyQuizStats();
      const solved = stats.solved || 0;
      const correct = stats.correct || 0;
      const wrong = Math.max(0, solved - correct);
      const rate = solved > 0 ? Math.round((correct / solved) * 100) : 0;
      const parts = (stats.date || getTodayKey()).split('-');

      if ($('statsDate')) $('statsDate').textContent = `${parts[0]}. ${parts[1]}. ${parts[2]}`;
      if ($('statsSolved')) $('statsSolved').textContent = `${solved}개`;
      if ($('statsCorrect')) $('statsCorrect').textContent = `${correct}개`;
      if ($('statsWrong')) $('statsWrong').textContent = `${wrong}개`;
      if ($('statsRatePercent')) $('statsRatePercent').textContent = `${rate}%`;
      if ($('statsRateBar')) $('statsRateBar').style.width = `${rate}%`;

      const renderType = (typeKey, countId, rateId, barId) => {
        const typeData = stats.byType?.[typeKey] || { solved: 0, correct: 0 };
        const tSolved = typeData.solved || 0;
        const tCorrect = typeData.correct || 0;
        const tRate = tSolved > 0 ? Math.round((tCorrect / tSolved) * 100) : 0;

        if ($(countId)) $(countId).textContent = `${tCorrect} / ${tSolved}퀴즈`;
        if ($(rateId)) $(rateId).textContent = `${tRate}%`;
        if ($(barId)) $(barId).style.width = `${tRate}%`;
      };

      renderType('free', 'freeStatCount', 'freeStatRate', 'freeStatBar');
      renderType('throw', 'throwStatCount', 'throwStatRate', 'throwStatBar');
      renderType('coaster', 'coasterStatCount', 'coasterStatRate', 'coasterStatBar');
    } else {
      const stats = getDailyGameStats();
      const solved = stats.solved || 0;
      const s3 = stats.stars?.s3 || 0;
      const s2 = stats.stars?.s2 || 0;
      const s1 = stats.stars?.s1 || 0;
      const s0 = stats.stars?.s0 || 0;
      const parts = (stats.date || getTodayKey()).split('-');

      if ($('statsDate')) $('statsDate').textContent = `${parts[0]}. ${parts[1]}. ${parts[2]}`;
      if ($('gameTotalSolved')) $('gameTotalSolved').textContent = `${solved}개`;
      if ($('gameStar3Count')) $('gameStar3Count').textContent = `${s3} / ${solved}개`;
      if ($('gameStar2Count')) $('gameStar2Count').textContent = `${s2} / ${solved}개`;
      if ($('gameStar1Count')) $('gameStar1Count').textContent = `${s1} / ${solved}개`;
      if ($('gameStar0Count')) $('gameStar0Count').textContent = `${s0} / ${solved}개`;

      const renderGameType = (typeKey, totalId, s3Id, s2Id, s1Id, s0Id) => {
        const typeData = stats.byType?.[typeKey] || { solved: 0, stars: { s3: 0, s2: 0, s1: 0, s0: 0 } };
        const tSolved = typeData.solved || 0;
        const ts3 = typeData.stars?.s3 || 0;
        const ts2 = typeData.stars?.s2 || 0;
        const ts1 = typeData.stars?.s1 || 0;
        const ts0 = typeData.stars?.s0 || 0;

        if ($(totalId)) $(totalId).textContent = `총 ${tSolved}개 도전`;
        if ($(s3Id)) $(s3Id).textContent = `${ts3}/${tSolved}개`;
        if ($(s2Id)) $(s2Id).textContent = `${ts2}/${tSolved}개`;
        if ($(s1Id)) $(s1Id).textContent = `${ts1}/${tSolved}개`;
        if ($(s0Id)) $(s0Id).textContent = `${ts0}/${tSolved}개`;
      };

      renderGameType('free', 'gameFreeTotal', 'gameFreeS3', 'gameFreeS2', 'gameFreeS1', 'gameFreeS0');
      renderGameType('throw', 'gameThrowTotal', 'gameThrowS3', 'gameThrowS2', 'gameThrowS1', 'gameThrowS0');
      renderGameType('coaster', 'gameCoasterTotal', 'gameCoasterS3', 'gameCoasterS2', 'gameCoasterS1', 'gameCoasterS0');
    }

    modal.hidden = false;
    $('statsCloseBtn')?.focus?.();
  };

  const closeStatsModal = () => {
    const modal = $('statsModal');
    if (modal) modal.hidden = true;
  };

  $('modalCloseBtn')?.addEventListener('click', closeAlertModal);
  $('alertModal')?.addEventListener('click', e => {
    if (e.target === $('alertModal')) closeAlertModal();
  });

  $('statsBtn')?.addEventListener('click', showStatsModal);
  $('sensoryStatsBtn')?.addEventListener('click', showStatsModal);
  $('statsCloseBtn')?.addEventListener('click', closeStatsModal);
  $('statsModal')?.addEventListener('click', e => {
    if (e.target === $('statsModal')) closeStatsModal();
  });

  $('labModeBtn')?.addEventListener('click', () => setAppMode('lab'));
  $('quizModeBtn')?.addEventListener('click', () => setAppMode('quiz'));
  $('gameModeBtn')?.addEventListener('click', () => setAppMode('game'));

  $('newQuestionBtn')?.addEventListener('click', () => { if (appMode === 'quiz') setupQuizQuestion(); });
  $('sensoryNewBtn')?.addEventListener('click', () => { if (appMode === 'game') setupSensoryQuestion(); });

  $('sensoryLaunchBtn')?.addEventListener('click', () => {
    if (sensoryState === 'graded') {
      setupSensoryQuestion();
      return;
    }
    const btn = $('start');
    if (btn?.click) btn.click();
    else if (btn?.onclick) btn.onclick();
  });

  $('submitAnswerBtn')?.addEventListener('click', () => {
    if (quizState === 'graded') {
      setupQuizQuestion();
      return;
    }
    const val = $('prediction')?.valueAsNumber;
    if (!Number.isFinite(val) || val <= 0) {
      showAlertModal('정답을 입력해 주세요!', '정답 입력칸에 숫자를 입력한 후 <b>[정답 확인하기]</b> 버튼을 누르면 채점이 시작됩니다.');
      return;
    }
    $('start')?.click();
  });

  $('prediction')?.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      $('submitAnswerBtn')?.click();
    }
  });

  $('formulaWinBtn')?.addEventListener('click', () => {
    window.open('formula.html', 'FormulaQuizWin', 'width=640,height=760,resizable=yes,scrollbars=yes');
  });
})();
