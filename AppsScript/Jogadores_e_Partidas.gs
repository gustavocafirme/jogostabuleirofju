/**
 * Regras de negócio, operações de CRUD de jogadores e cálculo de Elo/Partidas.
 */

function handleAddPlayer(modalidade, nome, usuario) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(modalidade);
  const id = 'PL_' + new Date().getTime();
  sheet.appendRow([id, nome, 500, 0, 0]); // ID, Nome, Elo, Vitórias, Partidas
  
  registrarLog(usuario, 'Criação de Jogador', modalidade, nome, `ID gerado: ${id}`);
  
  const updatedData = updateModalityCache(modalidade);
  return responseJSON({ status: 'success', data: updatedData });
}

function handleDeletePlayer(modalidade, playerId, usuario) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(modalidade);
  const backupSheet = ss.getSheetByName('Backup_' + modalidade);
  
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === playerId) {
      const p = data[i];
      backupSheet.appendRow([p[0], p[1], p[2], p[3], p[4], new Date().toLocaleString('pt-BR'), usuario]);
      sheet.deleteRow(i + 1);
      registrarLog(usuario, 'Exclusão de Jogador', modalidade, p[1], `Movido para o backup por ${usuario}`);
      
      const updatedData = updateModalityCache(modalidade);
      return responseJSON({ status: 'success', data: updatedData });
    }
  }
  return responseJSON({ status: 'error', message: 'Jogador não encontrado' });
}

function handleRestorePlayer(modalidade, playerId, usuario) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const backupSheet = ss.getSheetByName('Backup_' + modalidade);
  const sheet = ss.getSheetByName(modalidade);
  
  const data = backupSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === playerId) {
      const p = data[i];
      sheet.appendRow([p[0], p[1], p[2], p[3], p[4]]);
      backupSheet.deleteRow(i + 1);
      registrarLog(usuario, 'Restauração de Jogador', modalidade, p[1], `Restaurado por ${usuario}`);
      
      const updatedData = updateModalityCache(modalidade);
      return responseJSON({ status: 'success', data: updatedData });
    }
  }
  return responseJSON({ status: 'error', message: 'Jogador não encontrado no backup' });
}

function handleRecordMatch(data, usuario) {
  const mod = data.modalidade;
  const modoJogo = data.modoJogo || 'individual';
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(mod);
  const rows = sheet.getDataRange().getValues();
  
  let playersMap = {};
  for (let i = 1; i < rows.length; i++) {
    playersMap[rows[i][0]] = {
      rowIndex: i,
      id: rows[i][0],
      nome: rows[i][1],
      rating: parseFloat(rows[i][2]),
      vitorias: parseInt(rows[i][3]) || 0,
      partidas: parseInt(rows[i][4]) || 0
    };
  }

  const playersList = data.jogadores;

  const ids = playersList.map(p => p.id);
  if (new Set(ids).size !== ids.length) {
    return responseJSON({ status: 'error', message: 'O mesmo jogador não pode ser selecionado mais de uma vez.' });
  }

  let nomesEnvolvidos = playersList.map(p => playersMap[p.id] ? playersMap[p.id].nome : 'Desconhecido').join(', ');
  let logDetalhesParts = [];
  let eloChanges = [];

  if (mod === 'Xadrez' || mod === 'Damas') {
    if (playersList.length !== 2) {
      return responseJSON({ status: 'error', message: 'Xadrez e Damas exigem exatamente 2 jogadores.' });
    }

    const pA = playersMap[playersList[0].id];
    const pB = playersMap[playersList[1].id];
    
    const oldRatingA = pA.rating;
    const oldRatingB = pB.rating;

    const EA = 1 / (1 + Math.pow(10, (pB.rating - pA.rating) / 400));
    const EB = 1 - EA;
    const KA = Math.max(16, 160 / Math.sqrt(pA.partidas + 1));
    const KB = Math.max(16, 160 / Math.sqrt(pB.partidas + 1));

    if (mod === 'Xadrez') {
      const resA = playersList[0].resultado;
      let scoreA = 0.5;
      if (resA === 'vitoria' || resA === 1) scoreA = 1.0;
      else if (resA === 'derrota' || resA === 0) scoreA = 0.0;

      pA.rating += KA * (scoreA - EA);
      pB.rating += KB * ((1 - scoreA) - EB);
      
      if (scoreA === 1) { pA.vitorias++; }
      else if (scoreA === 0) { pB.vitorias++; }

      logDetalhesParts.push(`${pA.nome}: ${resA}, ${pB.nome}: ${resA === 'vitoria' ? 'derrota' : (resA === 'derrota' ? 'vitoria' : 'empate')}`);
    } else {
      const D = parseInt(playersList[0].pecasOuCartas || 0) - parseInt(playersList[1].pecasOuCartas || 0);
      const resA = playersList[0].resultado;
      let SA = 0.5;
      if (resA === 'vitoria') SA = 1.0;
      else if (resA === 'derrota') SA = 0.0;
      
      const M = Math.min(1.0, Math.log(1 + Math.abs(D)) / Math.log(1 + 8));
      if (resA === 'empate') {
        SA = D > 0 ? (0.50 + 0.25 * M) : (D < 0 ? (0.50 - 0.25 * M) : 0.5);
      }

      const perfA = SA - EA;
      const perfB = (1 - SA) - EB;
      const bonusPerformance = -(perfA + perfB) / 2;

      pA.rating += KA * (perfA + bonusPerformance);
      pB.rating += KB * (perfB + bonusPerformance);

      if (resA === 'vitoria') { pA.vitorias++; }
      else if (resA === 'derrota') { pB.vitorias++; }

      logDetalhesParts.push(`Saldo Peças: ${D} | ${pA.nome}: ${resA} (${parseInt(playersList[0].pecasOuCartas || 0)} pçs), ${pB.nome}: ${resA === 'vitoria' ? 'derrota' : 'vitoria'} (${parseInt(playersList[1].pecasOuCartas || 0)} pçs)`);
    }

    eloChanges.push(`${pA.nome}: ${oldRatingA} ➔ ${pA.rating}`);
    eloChanges.push(`${pB.nome}: ${oldRatingB} ➔ ${pB.rating}`);

    pA.partidas++;
    pB.partidas++;

    rows[pA.rowIndex][2] = pA.rating;
    rows[pA.rowIndex][3] = pA.vitorias;
    rows[pA.rowIndex][4] = pA.partidas;
    
    rows[pB.rowIndex][2] = pB.rating;
    rows[pB.rowIndex][3] = pB.vitorias;
    rows[pB.rowIndex][4] = pB.partidas;

  } else if (mod === 'Domino' || mod === 'Uno') {
    const N = playersList.length;

    let numEquipes = N;
    let tamanhoEquipe = 1;
    if (modoJogo === 'equipe') {
      const eqSet = new Set(playersList.map(p => p.equipeIndex));
      numEquipes = eqSet.size;
      tamanhoEquipe = N / numEquipes;
    }

    const oponentesVirtuais = modoJogo === 'equipe' ? (N - tamanhoEquipe + 1) : N;

    let C_max = 108 - (oponentesVirtuais - 1);
    if (mod === 'Domino') {
      if (oponentesVirtuais === 2) C_max = 153;
      else if (oponentesVirtuais === 3) C_max = 118;
      else C_max = 69;
    }

    let totalRestanteMesa = 0;
    if (modoJogo === 'equipe') {
      const eqSomas = {};
      playersList.forEach(p => {
        if (eqSomas[p.equipeIndex] === undefined) {
          eqSomas[p.equipeIndex] = p.resultado === 'vitoria' ? 0 : (parseInt(p.pecasOuCartas) || 0);
        }
      });
      Object.values(eqSomas).forEach(val => totalRestanteMesa += val);
    } else {
      playersList.forEach(p => {
        if (p.resultado !== 'vitoria') totalRestanteMesa += parseInt(p.pecasOuCartas) || 0;
      });
    }

    const M_mesa = Math.min(1.0, Math.log(1 + totalRestanteMesa) / Math.log(1 + C_max));
    const S_vencedor = 0.75 + 0.25 * M_mesa;
    const boloPerdedores = (numEquipes / 2) - S_vencedor;

    playersList.forEach(p => {
      if (p.resultado === 'vitoria') {
        p.S = S_vencedor;
      } else if (p.resultado === 'empate') {
        p.S = 0.5;
      } else {
        if (numEquipes === 2) {
          p.S = boloPerdedores;
        } else {
          p.S = boloPerdedores * (1 - ((parseInt(p.pecasOuCartas) || 0) / (totalRestanteMesa || 1))) * (1 / (numEquipes - 2));
        }
      }
    });

    let performancesBrutas = [];
    let somaPerformances = 0;

    playersList.forEach(p => {
      const dbPlayer = playersMap[p.id];
      let sumE = 0;
      playersList.forEach(adj => {
        if (adj.id !== p.id) {
          sumE += 1 / (1 + Math.pow(10, (playersMap[adj.id].rating - dbPlayer.rating) / 400));
        }
      });
      const Ei = sumE / (N - 1);
      const perfBruta = p.S - Ei;
      
      performancesBrutas.push(perfBruta);
      somaPerformances += perfBruta;
    });

    const ajusteSimetriaPerformance = -somaPerformances / N;
    const labelItem = mod === 'Domino' ? 'Pontinhos restantes' : 'Cartas restantes';

    playersList.forEach((p, idx) => {
      const dbPlayer = playersMap[p.id];
      const oldRating = dbPlayer.rating;
      const Ki = Math.max(16, 160 / Math.sqrt(dbPlayer.partidas + 1));
      
      const deltaEloFinal = Ki * (performancesBrutas[idx] + ajusteSimetriaPerformance);
      
      dbPlayer.rating += deltaEloFinal;
      dbPlayer.partidas++;

      if (p.resultado === 'vitoria') {
        dbPlayer.vitorias++;
      }

      rows[dbPlayer.rowIndex][2] = dbPlayer.rating;
      rows[dbPlayer.rowIndex][3] = dbPlayer.vitorias;
      rows[dbPlayer.rowIndex][4] = dbPlayer.partidas;

      const tagEq = modoJogo === 'equipe' ? ` (Eq ${p.equipeIndex + 1})` : '';
      logDetalhesParts.push(`${dbPlayer.nome}${tagEq}: ${p.resultado}, ${labelItem}: ${p.pecasOuCartas}`);
      eloChanges.push(`${dbPlayer.nome}: ${oldRating} ➔ ${dbPlayer.rating}`);
    });

    logDetalhes = `Mesa de ${N} jogadores (${modoJogo === 'equipe' ? numEquipes + ' equipes' : 'Individual'}). ${logDetalhesParts.join('; ')}`;
  } else {
    logDetalhes = `Mesa de ${playersList.length} jogadores. ${logDetalhesParts.join('; ')}`;
  }

  logDetalhes += ` | Elo: [${eloChanges.join('; ')}]`;

  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);

  registrarLog(usuario, 'Registro de Partida', mod, nomesEnvolvidos, logDetalhes);

  const updatedData = updateModalityCache(mod);
  return responseJSON({ status: 'success', data: updatedData });
}