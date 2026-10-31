/**
 * Cache isolado por modalidade e modo de jogo para persistência de estado.
 */
if (typeof window.matchFormCache === 'undefined') {
  window.matchFormCache = {};
}

function getCurrentFormCacheKey() {
  return `${state.currentMod}_${state.modoJogo}`;
}

function saveCurrentFormState() {
  const formContainer = document.getElementById('matchForm');
  if (!formContainer) return;

  const key = getCurrentFormCacheKey();
  const stateData = {
    modoJogo: state.modoJogo,
    qtdMesa: document.getElementById('qtdMesa')?.value,
    tamanhoGrupo: document.getElementById('tamanhoGrupo')?.value,
    qtdEquipes: document.getElementById('qtdEquipes')?.value,
    individualCards: [],
    teamCards: []
  };

  const currentCards = formContainer.querySelectorAll('.player-card');
  currentCards.forEach((card) => {
    const selPlayer = card.querySelector('.mPlayer');
    const selRes = card.querySelector('.mResultado');
    const inpPecas = card.querySelector('.mPecasCartas');
    stateData.individualCards.push({
      playerId: selPlayer ? selPlayer.value : '',
      resultado: selRes ? selRes.value : '',
      pecasCartas: inpPecas ? inpPecas.value : ''
    });
  });

  const currentTeams = formContainer.querySelectorAll('.team-container');
  currentTeams.forEach((teamEl) => {
    const selRes = teamEl.querySelector('.mTeamResultado');
    const inpPecas = teamEl.querySelector('.mTeamPecasCartas');
    const pSelects = teamEl.querySelectorAll('.mPlayer');
    const pIds = Array.from(pSelects).map(s => s.value);
    stateData.teamCards.push({
      resultado: selRes ? selRes.value : '',
      pecasCartas: inpPecas ? inpPecas.value : '',
      playerIds: pIds
    });
  });

  window.matchFormCache[key] = stateData;
}

/**
 * Roteador principal do container do formulário de partidas.
 */
function renderMatchForm() {
  const formContainer = document.getElementById('matchForm');
  if (!formContainer) return;

  const key = getCurrentFormCacheKey();
  const cachedData = window.matchFormCache[key] || {};

  const players = (state.dbData.rankings && state.dbData.rankings[state.currentMod]) 
    ? [...state.dbData.rankings[state.currentMod]] 
    : [];
  
  players.sort((a, b) => a.nome.localeCompare(b.nome));

  const submitBtn = document.getElementById('btnSubmitMatch');
  
  if (players.length < 2) {
    formContainer.innerHTML = "<p class='loading-text'>Cadastre pelo menos 2 jogadores para registrar partidas.</p>";
    if (submitBtn) {
      submitBtn.classList.add('hidden');
      submitBtn.disabled = true;
    }
    return;
  }

  if (state.modoJogo === 'equipe' && players.length < 4) {
    state.modoJogo = 'individual';
  }

  if (submitBtn) {
    submitBtn.classList.remove('hidden');
    submitBtn.disabled = false;
  }

  let htmlContent = '';

  if (state.currentMod === 'Domino' || state.currentMod === 'Uno') {
    const canPlayTeams = players.length >= 4;
    const titleTooltip = canPlayTeams ? '' : 'title="Cadastre pelo menos 4 jogadores para liberar o modo em equipes"';

    htmlContent += `
      <div class="tabs-modo-jogo">
        <button class="modo-btn ${state.modoJogo === 'individual' ? 'active' : ''}" onclick="setGameMode('individual')">👤 Individual</button>
        <button class="modo-btn ${state.modoJogo === 'equipe' ? 'active' : ''}" 
                onclick="setGameMode('equipe')" 
                ${!canPlayTeams ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''} 
                ${titleTooltip}>
          👥 Em Equipes ${!canPlayTeams ? '(Min. 4 Jogadores)' : ''}
        </button>
      </div>
    `;
  }

  if (state.modoJogo === 'equipe' && (state.currentMod === 'Domino' || state.currentMod === 'Uno')) {
    htmlContent += buildTeamFormHTML(players, cachedData);
  } else {
    htmlContent += buildIndividualFormHTML(players, cachedData);
  }

  formContainer.innerHTML = htmlContent;

  if (cachedData.tamanhoGrupo) {
    const tgEl = document.getElementById('tamanhoGrupo');
    if (tgEl) tgEl.value = cachedData.tamanhoGrupo;
  }

  if (state.modoJogo === 'equipe' && state.currentMod === 'Uno') {
    updateTeamCountOptions();
    if (cachedData.qtdEquipes) {
      const qeEl = document.getElementById('qtdEquipes');
      if (qeEl) qeEl.value = cachedData.qtdEquipes;
    }
  }

  if (cachedData.qtdMesa) {
    const qmEl = document.getElementById('qtdMesa');
    if (qmEl) qmEl.value = cachedData.qtdMesa;
  }

  updateDynamicPlayersForm();
}

function setGameMode(mode) {
  saveCurrentFormState();
  state.modoJogo = mode;
  if (!window.modModes) window.modModes = {};
  window.modModes[state.currentMod] = mode;
  renderMatchForm();
}

function buildIndividualFormHTML(players, cachedData = {}) {
  if (state.currentMod === 'Xadrez' || state.currentMod === 'Damas') {
    return `<input type="hidden" id="qtdMesa" value="2"><div id="dynamicPlayersContainer"></div>`;
  } else {
    const maxPlayers = state.currentMod === 'Domino' ? Math.min(4, players.length) : Math.min(10, players.length);
    let defaultCount = cachedData.qtdMesa ? parseInt(cachedData.qtdMesa) : Math.min(state.currentMod === 'Domino' ? 4 : 2, maxPlayers);
    if (defaultCount < 2) defaultCount = 2;
    if (defaultCount > maxPlayers) defaultCount = maxPlayers;

    return `
      <div id="qtdMesaContainer">
        <label>Quantidade de Jogadores na Mesa (Máx: ${maxPlayers}):</label>
        <input type="number" id="qtdMesa" value="${defaultCount}" min="2" max="${maxPlayers}" onchange="saveCurrentFormState(); updateDynamicPlayersForm()">
      </div>
      <div id="dynamicPlayersContainer"></div>
    `;
  }
}

function buildTeamFormHTML(players, cachedData = {}) {
  if (state.currentMod === 'Domino') {
    return `
      <input type="hidden" id="tamanhoGrupo" value="2">
      <input type="hidden" id="qtdEquipes" value="2">
      <div id="dynamicPlayersContainer"></div>
    `;
  } else {
    const maxP = players.length;
    let savedSize = cachedData.tamanhoGrupo || '2';
    let sizeOptions = [];
    if (maxP >= 4) sizeOptions.push(`<option value="2" ${savedSize === '2' ? 'selected' : ''}>Duplas (2 por equipe)</option>`);
    if (maxP >= 6) sizeOptions.push(`<option value="3" ${savedSize === '3' ? 'selected' : ''}>Trios (3 por equipe)</option>`);
    if (maxP >= 8) sizeOptions.push(`<option value="4" ${savedSize === '4' ? 'selected' : ''}>Quartetos (4 por equipe)</option>`);
    if (maxP >= 10) sizeOptions.push(`<option value="5" ${savedSize === '5' ? 'selected' : ''}>Quintetos (5 por equipe)</option>`);

    return `
      <div style="display:flex; gap:12px; flex-wrap:wrap;">
        <div style="flex:1; min-width:180px;">
          <label>Tamanho da Equipe:</label>
          <select id="tamanhoGrupo" onchange="saveCurrentFormState(); updateTeamCountOptions()">${sizeOptions.join('')}</select>
        </div>
        <div style="flex:1; min-width:180px;">
          <label>Quantidade de Equipes:</label>
          <select id="qtdEquipes" onchange="saveCurrentFormState(); updateDynamicPlayersForm()"></select>
        </div>
      </div>
      <div id="dynamicPlayersContainer"></div>
    `;
  }
}

function updateTeamCountOptions() {
  const sizeSelect = document.getElementById('tamanhoGrupo');
  const countSelect = document.getElementById('qtdEquipes');
  if (!sizeSelect || !countSelect) return;

  const teamSize = parseInt(sizeSelect.value) || 2;
  const players = (state.dbData.rankings && state.dbData.rankings[state.currentMod]) ? state.dbData.rankings[state.currentMod] : [];
  const maxPossibleTeams = Math.floor(players.length / teamSize);
  const maxLimit = Math.min(5, maxPossibleTeams);

  const key = getCurrentFormCacheKey();
  const cachedData = window.matchFormCache[key] || {};
  const savedEquipes = cachedData.qtdEquipes || '2';

  let optionsHtml = [];
  for (let i = 2; i <= maxLimit; i++) {
    optionsHtml.push(`<option value="${i}" ${i.toString() === savedEquipes.toString() ? 'selected' : ''}>${i} Equipes</option>`);
  }
  countSelect.innerHTML = optionsHtml.join('');
  updateDynamicPlayersForm();
}

function updateDynamicPlayersForm() {
  const container = document.getElementById('dynamicPlayersContainer');
  if (!container) return;

  const key = getCurrentFormCacheKey();
  const cachedData = window.matchFormCache[key] || {};

  const players = (state.dbData.rankings && state.dbData.rankings[state.currentMod]) 
    ? [...state.dbData.rankings[state.currentMod]] 
    : [];
  
  players.sort((a, b) => a.nome.localeCompare(b.nome));

  if (state.modoJogo === 'equipe' && (state.currentMod === 'Domino' || state.currentMod === 'Uno')) {
    if (state.currentMod === 'Uno') {
      const countSelect = document.getElementById('qtdEquipes');
      if (!countSelect || !countSelect.value) {
        updateTeamCountOptions();
        return;
      }
    }
    renderTeamTable(container, players, cachedData.teamCards || []);
  } else {
    renderIndividualTable(container, players, cachedData.individualCards || []);
  }
}

function renderIndividualTable(container, players, savedData = []) {
  const countInput = document.getElementById('qtdMesa');
  let playerLimit = countInput ? parseInt(countInput.value) || 2 : 2;
  let maxAllowed = (state.currentMod === 'Domino') ? Math.min(4, players.length) : (state.currentMod === 'Uno' ? Math.min(10, players.length) : 2);

  if (playerLimit > maxAllowed) { playerLimit = maxAllowed; if (countInput) countInput.value = playerLimit; }
  if (playerLimit < 2) { playerLimit = 2; if (countInput) countInput.value = playerLimit; }

  let vitoriasCount = 0;
  for (let i = 0; i < playerLimit; i++) {
    if (savedData[i] && savedData[i].resultado === 'vitoria') vitoriasCount++;
  }
  if (savedData.length > 0 && vitoriasCount === 0 && (state.currentMod === 'Uno' || state.currentMod === 'Domino')) {
    if (savedData[0]) savedData[0].resultado = 'vitoria';
  }

  let htmlContent = '';
  for (let i = 0; i < playerLimit; i++) {
    let currentSaved = savedData[i] || {};
    
    let defaultPlayerId = '';
    if (currentSaved.playerId) {
      defaultPlayerId = currentSaved.playerId;
    } else if (players.length >= 2) {
      defaultPlayerId = players[i % players.length]?.id || '';
    } else {
      defaultPlayerId = players[0]?.id || '';
    }

    let options = players.map(p => `<option value="${p.id}" ${p.id === defaultPlayerId ? 'selected' : ''}>${p.nome} (${Math.round(p.rating)})</option>`).join('');

    let defaultRes = currentSaved.resultado || (i === 0 ? 'vitoria' : 'derrota');
    let resOptions = state.currentMod === 'Uno' 
      ? `<option value="vitoria" ${defaultRes === 'vitoria' ? 'selected' : ''}>Vitória</option><option value="derrota" ${defaultRes === 'derrota' || defaultRes !== 'vitoria' ? 'selected' : ''}>Derrota</option>`
      : `<option value="vitoria" ${defaultRes === 'vitoria' ? 'selected' : ''}>Vitória</option><option value="derrota" ${defaultRes === 'derrota' ? 'selected' : ''}>Derrota</option><option value="empate" ${defaultRes === 'empate' ? 'selected' : ''}>Empate</option>`;

    let fieldHtml = '';
    if (state.currentMod !== 'Xadrez') {
      let label = '', minVal = 0, maxVal = 100, defaultVal = currentSaved.pecasCartas !== undefined && currentSaved.pecasCartas !== '' ? currentSaved.pecasCartas : (i === 0 ? 0 : 1);
      if (state.currentMod === 'Damas') {
        label = 'Peças restantes:'; maxVal = 12; minVal = (i === 0) ? 1 : 0;
      } else if (state.currentMod === 'Uno') {
        label = 'Cartas restantes:'; maxVal = 108 - (playerLimit - 1); minVal = (i > 0) ? 1 : 0;
      } else if (state.currentMod === 'Domino') {
        label = 'Pontinhos restantes:'; minVal = 0;
        maxVal = (playerLimit === 2) ? 153 : (playerLimit === 3 ? 118 : 69);
      }
      fieldHtml = `<label class="lblPecasCartas" style="margin-top:8px; display:block;">${label}</label><input type="number" class="mPecasCartas" value="${defaultVal}" min="${minVal}" max="${maxVal}" onchange="saveCurrentFormState(); validateDominoPoints()" oninput="saveCurrentFormState(); validateDominoPoints()">`;
    }

    htmlContent += `
      <div class="player-card" style="border:1px solid var(--card-border); background: #0b111e; padding:12px; margin-top:10px; border-radius:8px;" data-index="${i}">
        <label style="font-weight:600; color:var(--muted);">Jogador ${i+1}:</label>
        <select class="mPlayer" onchange="saveCurrentFormState(); validatePlayerSelection()">${options}</select>
        <label style="margin-top:8px; display:block; font-weight:600; color:var(--muted);">Resultado:</label>
        <select class="mResultado" onchange="saveCurrentFormState(); handleResultChange(${i})">${resOptions}</select>
        ${fieldHtml}
      </div>
    `;
  }

  container.innerHTML = htmlContent;
  for (let i = 0; i < playerLimit; i++) adjustPieceCardLimits(i);
  validatePlayerSelection();
}

function renderTeamTable(container, players, savedTeams = []) {
  const sizeInput = document.getElementById('tamanhoGrupo');
  const countInput = document.getElementById('qtdEquipes');

  const teamSize = sizeInput ? parseInt(sizeInput.value) || 2 : 2;
  const numTeams = countInput ? parseInt(countInput.value) || 2 : 2;
  const totalPlayers = teamSize * numTeams;

  let htmlContent = '';
  let playerCounter = 0;

  for (let teamIdx = 0; teamIdx < numTeams; teamIdx++) {
    const colorClass = `team-bg-${teamIdx % 5}`;
    const currentSavedTeam = savedTeams[teamIdx] || {};
    
    let defaultRes = currentSavedTeam.resultado || (teamIdx === 0 ? 'vitoria' : 'derrota');
    let resOptions = state.currentMod === 'Uno'
      ? `<option value="vitoria" ${defaultRes === 'vitoria' ? 'selected' : ''}>Vitória</option><option value="derrota" ${defaultRes === 'derrota' || defaultRes !== 'vitoria' ? 'selected' : ''}>Derrota</option>`
      : `<option value="vitoria" ${defaultRes === 'vitoria' ? 'selected' : ''}>Vitória</option><option value="derrota" ${defaultRes === 'derrota' ? 'selected' : ''}>Derrota</option><option value="empate" ${defaultRes === 'empate' ? 'selected' : ''}>Empate</option>`;

    let fieldHtml = '';
    let defaultValPecas = currentSavedTeam.pecasCartas !== undefined && currentSavedTeam.pecasCartas !== '' ? currentSavedTeam.pecasCartas : (teamIdx === 0 ? 0 : 1);
    if (state.currentMod === 'Domino') {
      fieldHtml = `<label style="margin-top:8px; display:block; font-weight:600;">Pontinhos restantes da Equipe:</label>
                   <input type="number" class="mTeamPecasCartas" data-team="${teamIdx}" value="${defaultValPecas}" min="0" max="118" onchange="saveCurrentFormState(); validateDominoPoints()" oninput="saveCurrentFormState(); validateDominoPoints()">`;
    } else if (state.currentMod === 'Uno') {
      const virtualOpponents = totalPlayers - teamSize + 1;
      const maxCards = 108 - (virtualOpponents - 1);
      fieldHtml = `<label style="margin-top:8px; display:block; font-weight:600;">Cartas restantes da Equipe:</label>
                   <input type="number" class="mTeamPecasCartas" data-team="${teamIdx}" value="${defaultValPecas}" min="${teamIdx === 0 ? 0 : 1}" max="${maxCards}" onchange="saveCurrentFormState(); validateDominoPoints()" oninput="saveCurrentFormState(); validateDominoPoints()">`;
    }

    htmlContent += `
      <div class="team-container ${colorClass}" data-team-index="${teamIdx}">
        <span class="team-title">🛡️ Equipe ${teamIdx + 1}</span>
        
        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:10px;">
          <div style="flex:1; min-width:140px;">
            <label style="font-weight:600;">Resultado da Equipe:</label>
            <select class="mTeamResultado" data-team="${teamIdx}" onchange="saveCurrentFormState(); handleTeamResultChange(${teamIdx})">${resOptions}</select>
          </div>
          <div style="flex:1; min-width:140px;">${fieldHtml}</div>
        </div>

        <div class="team-players-list">
    `;

    for (let p = 0; p < teamSize; p++) {
      let savedIdForSlot = currentSavedTeam.playerIds && currentSavedTeam.playerIds[p] ? currentSavedTeam.playerIds[p] : '';
      let selectedPlayerId = savedIdForSlot || players[playerCounter % players.length]?.id || '';
      let options = players.map(pl => `<option value="${pl.id}" ${pl.id === selectedPlayerId ? 'selected' : ''}>${pl.nome} (${Math.round(pl.rating)})</option>`).join('');

      htmlContent += `
        <div style="margin-top:6px;">
          <label style="font-size:0.85rem; color:var(--muted);">Jogador ${p + 1} da Equipe:</label>
          <select class="mPlayer" data-team="${teamIdx}" onchange="saveCurrentFormState(); validatePlayerSelection()">${options}</select>
        </div>
      `;
      playerCounter++;
    }

    htmlContent += `</div></div>`;
  }

  container.innerHTML = htmlContent;
  for (let teamIdx = 0; teamIdx < numTeams; teamIdx++) adjustTeamPieceCardLimits(teamIdx);
  validatePlayerSelection();
}

function handleTeamResultChange(changedTeamIdx) {
  saveCurrentFormState();
  const formContainer = document.getElementById('matchForm');
  const teamResultSelects = formContainer ? formContainer.querySelectorAll('.mTeamResultado') : document.querySelectorAll('.mTeamResultado');
  const teamCount = teamResultSelects.length;
  const newValue = teamResultSelects[changedTeamIdx].value;

  if (state.currentMod === 'Domino' || state.currentMod === 'Uno') {
    if (newValue === 'vitoria') {
      teamResultSelects.forEach((select, idx) => {
        if (idx !== changedTeamIdx) select.value = 'derrota';
      });
    } else if (newValue === 'derrota' && teamCount === 2) {
      const otherIdx = changedTeamIdx === 0 ? 1 : 0;
      teamResultSelects[otherIdx].value = 'vitoria';
    } else if (newValue === 'empate' && state.currentMod === 'Domino') {
      if (teamCount === 2) {
        const otherIdx = changedTeamIdx === 0 ? 1 : 0;
        teamResultSelects[otherIdx].value = 'empate';
      } else {
        teamResultSelects.forEach(select => {
          if (select.value === 'vitoria') select.value = 'empate';
        });
      }
    }
  }

  teamResultSelects.forEach((_, idx) => adjustTeamPieceCardLimits(idx));
  saveCurrentFormState();
}

function adjustTeamPieceCardLimits(teamIdx) {
  const formContainer = document.getElementById('matchForm');
  const teamContainer = formContainer ? formContainer.querySelector(`.team-container[data-team-index="${teamIdx}"]`) : document.querySelector(`.team-container[data-team-index="${teamIdx}"]`);
  if (!teamContainer) return;

  const resultSelect = teamContainer.querySelector('.mTeamResultado');
  const pieceInput = teamContainer.querySelector('.mTeamPecasCartas');
  if (!resultSelect || !pieceInput) return;

  const result = resultSelect.value;

  if (state.currentMod === 'Uno') {
    if (result === 'vitoria') {
      pieceInput.value = 0;
      pieceInput.min = 0;
      pieceInput.disabled = true;
    } else {
      pieceInput.disabled = false;
      pieceInput.min = 1;
      if (parseInt(pieceInput.value) < 1) pieceInput.value = 1;
    }
  } else if (state.currentMod === 'Domino') {
    if (result === 'vitoria' && parseInt(pieceInput.value) > 0) {
      pieceInput.value = 0;
    } else if (result === 'derrota' && parseInt(pieceInput.value) === 0) {
      pieceInput.value = 1;
    }
  }
  validateDominoPoints();
}

function handleResultChange(changedIndex) {
  saveCurrentFormState();
  const formContainer = document.getElementById('matchForm');
  const resultSelects = formContainer ? formContainer.querySelectorAll('.mResultado') : document.querySelectorAll('.mResultado');
  const playerCount = resultSelects.length;
  const newValue = resultSelects[changedIndex].value;

  if (state.currentMod === 'Xadrez' || state.currentMod === 'Damas') {
    const otherIndex = changedIndex === 0 ? 1 : 0;
    if (newValue === 'vitoria') resultSelects[otherIndex].value = 'derrota';
    else if (newValue === 'derrota') resultSelects[otherIndex].value = 'vitoria';
    else if (newValue === 'empate') resultSelects[otherIndex].value = 'empate';
  } else if (state.currentMod === 'Uno' || state.currentMod === 'Domino') {
    if (newValue === 'vitoria') {
      resultSelects.forEach((select, idx) => { if (idx !== changedIndex) select.value = 'derrota'; });
    } else if (newValue === 'derrota' && playerCount === 2) {
      const otherIdx = changedIndex === 0 ? 1 : 0;
      resultSelects[otherIdx].value = 'vitoria';
    } else if (newValue === 'empate' && state.currentMod === 'Domino') {
      if (playerCount === 2) {
        const otherIdx = changedIndex === 0 ? 1 : 0;
        resultSelects[otherIdx].value = 'empate';
      } else {
        resultSelects.forEach(select => { if (select.value === 'vitoria') select.value = 'empate'; });
      }
    }
  }

  for (let i = 0; i < playerCount; i++) adjustPieceCardLimits(i);
  saveCurrentFormState();
}

function adjustPieceCardLimits(index) {
  const formContainer = document.getElementById('matchForm');
  const cards = formContainer ? formContainer.querySelectorAll('.player-card') : document.querySelectorAll('.player-card');
  if (!cards[index]) return;
  
  const resultSelect = cards[index].querySelector('.mResultado');
  const pieceInput = cards[index].querySelector('.mPecasCartas');
  if (!resultSelect || !pieceInput) return;

  const result = resultSelect.value;
  const playerCount = cards.length;

  if (state.currentMod === 'Damas') {
    if (result === 'derrota') {
      pieceInput.min = 0; pieceInput.max = 0; pieceInput.value = 0; pieceInput.disabled = true;
    } else {
      pieceInput.disabled = false; pieceInput.min = 1; pieceInput.max = 12;
      if (parseInt(pieceInput.value) < 1) pieceInput.value = 1;
    }
  } else if (state.currentMod === 'Uno') {
    let maxCards = 108 - (playerCount - 1);
    if (result === 'derrota') {
      pieceInput.min = 1; pieceInput.max = maxCards;
      if (parseInt(pieceInput.value) < 1) pieceInput.value = 1;
      pieceInput.disabled = false;
    } else {
      pieceInput.min = 0; pieceInput.max = 0; pieceInput.value = 0;
      pieceInput.disabled = true; // Remove setas no Uno individual para o vencedor
    }
  } else if (state.currentMod === 'Domino') {
    let maxPoints = (playerCount === 2) ? 153 : (playerCount === 3 ? 118 : 69);
    pieceInput.min = 0; pieceInput.max = maxPoints;
    if (result === 'derrota' && parseInt(pieceInput.value) === 0) pieceInput.value = 1;
  }
  validateDominoPoints();
}

/**
 * Valida se o vencedor do Dominó possui estritamente menos pontinhos que os demais e destaca em vermelho se não for o caso.
 */
function validateDominoPoints() {
  if (state.currentMod !== 'Domino') return;
  const formContainer = document.getElementById('matchForm');
  if (!formContainer) return;

  if (state.modoJogo === 'equipe') {
    const teamContainers = formContainer.querySelectorAll('.team-container');
    let teams = [];
    teamContainers.forEach(tc => {
      const res = tc.querySelector('.mTeamResultado')?.value;
      const input = tc.querySelector('.mTeamPecasCartas');
      const pts = parseInt(input?.value) || 0;
      teams.push({ res, input, pts });
    });

    teams.forEach((t, idx) => {
      if (!t.input) return;
      if (t.res === 'vitoria') {
        // Verifica se existe QUALQUER outra equipe com pontinhos menores ou iguais
        const hasSmallerOrEqualOther = teams.some((other, oIdx) => oIdx !== idx && other.pts <= t.pts);
        if (hasSmallerOrEqualOther) {
          t.input.style.borderColor = 'var(--danger)';
        } else {
          t.input.style.borderColor = 'var(--card-border)';
        }
      } else {
        t.input.style.borderColor = 'var(--card-border)';
      }
    });
  } else {
    const cards = formContainer.querySelectorAll('.player-card');
    let participants = [];
    cards.forEach(card => {
      const res = card.querySelector('.mResultado')?.value;
      const input = card.querySelector('.mPecasCartas');
      const pts = parseInt(input?.value) || 0;
      participants.push({ res, input, pts });
    });

    participants.forEach((p, idx) => {
      if (!p.input) return;
      if (p.res === 'vitoria') {
        // Verifica se existe QUALQUER outro jogador com pontinhos menores ou iguais
        const hasSmallerOrEqualOther = participants.some((other, oIdx) => oIdx !== idx && other.pts <= p.pts);
        if (hasSmallerOrEqualOther) {
          p.input.style.borderColor = 'var(--danger)';
        } else {
          p.input.style.borderColor = 'var(--card-border)';
        }
      } else {
        p.input.style.borderColor = 'var(--card-border)';
      }
    });
  }
}

function validatePlayerSelection() {
  saveCurrentFormState();
  const formContainer = document.getElementById('matchForm');
  const playerSelects = formContainer ? formContainer.querySelectorAll('.mPlayer') : document.querySelectorAll('.mPlayer');
  const idCounts = {};

  playerSelects.forEach(select => {
    const id = select.value;
    if (id) {
      idCounts[id] = (idCounts[id] || 0) + 1;
    }
  });

  let hasDuplicate = false;

  playerSelects.forEach(select => {
    const id = select.value;
    if (id && idCounts[id] > 1) {
      hasDuplicate = true;
      select.style.borderColor = 'var(--danger)';
    } else {
      select.style.borderColor = 'var(--card-border)';
    }
  });

  validateDominoPoints();
  return !hasDuplicate;
}