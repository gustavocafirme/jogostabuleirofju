/**
 * Regras de negócio, operações de CRUD de jogadores e cálculo de Elo/Partidas.
 */

function handleAddPlayer(modality, name, user) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(modality);
  const id = 'PL_' + new Date().getTime();
  sheet.appendRow([id, name, 500, 0, 0]); // ID, Nome, Elo, Vitórias, Partidas
  
  registrarLog(user, 'Criação de Jogador', modality, name, `ID gerado: ${id}`);
  
  const updatedData = updateModalityCache(modality);
  return responseJSON({ status: 'success', data: updatedData });
}

function handleDeletePlayer(modality, playerId, user) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(modality);
  const backupSheet = spreadsheet.getSheetByName('Backup_' + modality);
  
  const sheetData = sheet.getDataRange().getValues();
  for (let i = 1; i < sheetData.length; i++) {
    if (sheetData[i][0] === playerId) {
      const playerRecord = sheetData[i];
      backupSheet.appendRow([playerRecord[0], playerRecord[1], playerRecord[2], playerRecord[3], playerRecord[4], new Date().toLocaleString('pt-BR'), user]);
      sheet.deleteRow(i + 1);
      registrarLog(user, 'Exclusão de Jogador', modality, playerRecord[1], `Movido para o backup por ${user}`);
      
      const updatedData = updateModalityCache(modality);
      return responseJSON({ status: 'success', data: updatedData });
    }
  }
  return responseJSON({ status: 'error', message: 'Jogador não encontrado' });
}

function handleRestorePlayer(modality, playerId, user) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const backupSheet = spreadsheet.getSheetByName('Backup_' + modality);
  const sheet = spreadsheet.getSheetByName(modality);
  
  const backupData = backupSheet.getDataRange().getValues();
  for (let i = 1; i < backupData.length; i++) {
    if (backupData[i][0] === playerId) {
      const playerRecord = backupData[i];
      sheet.appendRow([playerRecord[0], playerRecord[1], playerRecord[2], playerRecord[3], playerRecord[4]]);
      backupSheet.deleteRow(i + 1);
      registrarLog(user, 'Restauração de Jogador', modality, playerRecord[1], `Restaurado por ${user}`);
      
      const updatedData = updateModalityCache(modality);
      return responseJSON({ status: 'success', data: updatedData });
    }
  }
  return responseJSON({ status: 'error', message: 'Jogador não encontrado no backup' });
}

function handleRecordMatch(payloadData, user) {
  const modality = payloadData.modalidade;
  const gameMode = payloadData.modoJogo || 'individual';
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(modality);
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

  const playersList = payloadData.jogadores;

  const playerIds = playersList.map(p => p.id);
  if (new Set(playerIds).size !== playerIds.length) {
    return responseJSON({ status: 'error', message: 'O mesmo jogador não pode ser selecionado mais de uma vez.' });
  }

  let involvedNames = playersList.map(p => playersMap[p.id] ? playersMap[p.id].nome : 'Desconhecido').join(', ');
  let logDetailsParts = [];
  let eloChanges = [];

  if (modality === 'Xadrez' || modality === 'Damas') {
    if (playersList.length !== 2) {
      return responseJSON({ status: 'error', message: 'Xadrez e Damas exigem exatamente 2 jogadores.' });
    }

    const playerA = playersMap[playersList[0].id];
    const playerB = playersMap[playersList[1].id];
    
    const oldRatingA = playerA.rating;
    const oldRatingB = playerB.rating;

    const expectedA = 1 / (1 + Math.pow(10, (playerB.rating - playerA.rating) / 400));
    const expectedB = 1 - expectedA;
    const factorA = Math.max(16, 160 / Math.sqrt(playerA.partidas + 1));
    const factorB = Math.max(16, 160 / Math.sqrt(playerB.partidas + 1));

    if (modality === 'Xadrez') {
      const resultA = playersList[0].resultado;
      let scoreA = 0.5;
      if (resultA === 'vitoria' || resultA === 1) scoreA = 1.0;
      else if (resultA === 'derrota' || resultA === 0) scoreA = 0.0;

      playerA.rating += factorA * (scoreA - expectedA);
      playerB.rating += factorB * ((1 - scoreA) - expectedB);
      
      if (scoreA === 1) { playerA.vitorias++; }
      else if (scoreA === 0) { playerB.vitorias++; }

      logDetailsParts.push(`${playerA.nome}: ${resultA}, ${playerB.nome}: ${resultA === 'vitoria' ? 'derrota' : (resultA === 'derrota' ? 'vitoria' : 'empate')}`);
    } else {
      const diffPieces = parseInt(playersList[0].pecasOuCartas || 0) - parseInt(playersList[1].pecasOuCartas || 0);
      const resultA = playersList[0].resultado;
      let scoreA = 0.5;
      if (resultA === 'vitoria') scoreA = 1.0;
      else if (resultA === 'derrota') scoreA = 0.0;
      
      const marginFactor = Math.min(1.0, Math.log(1 + Math.abs(diffPieces)) / Math.log(1 + 8));
      if (resultA === 'empate') {
        scoreA = diffPieces > 0 ? (0.50 + 0.25 * marginFactor) : (diffPieces < 0 ? (0.50 - 0.25 * marginFactor) : 0.5);
      }

      const perfA = scoreA - expectedA;
      const perfB = (1 - scoreA) - expectedB;
      const bonusPerformance = -(perfA + perfB) / 2;

      playerA.rating += factorA * (perfA + bonusPerformance);
      playerB.rating += factorB * (perfB + bonusPerformance);

      if (resultA === 'vitoria') { playerA.vitorias++; }
      else if (resultA === 'derrota') { playerB.vitorias++; }

      logDetailsParts.push(`Saldo Peças: ${diffPieces} | ${playerA.nome}: ${resultA} (${parseInt(playersList[0].pecasOuCartas || 0)} pçs), ${playerB.nome}: ${resultA === 'vitoria' ? 'derrota' : 'vitoria'} (${parseInt(playersList[1].pecasOuCartas || 0)} pçs)`);
    }

    eloChanges.push(`${playerA.nome}: ${oldRatingA} ➔ ${playerA.rating}`);
    eloChanges.push(`${playerB.nome}: ${oldRatingB} ➔ ${playerB.rating}`);

    playerA.partidas++;
    playerB.partidas++;

    rows[playerA.rowIndex][2] = playerA.rating;
    rows[playerA.rowIndex][3] = playerA.vitorias;
    rows[playerA.rowIndex][4] = playerA.partidas;
    
    rows[playerB.rowIndex][2] = playerB.rating;
    rows[playerB.rowIndex][3] = playerB.vitorias;
    rows[playerB.rowIndex][4] = playerB.partidas;

  } else if (modality === 'Domino' || modality === 'Uno') {
    const totalPlayersCount = playersList.length;

    let numTeams = totalPlayersCount;
    let teamSize = 1;
    if (gameMode === 'equipe') {
      const teamSet = new Set(playersList.map(p => p.equipeIndex));
      numTeams = teamSet.size;
      teamSize = totalPlayersCount / numTeams;
    }

    const virtualOpponents = gameMode === 'equipe' ? (totalPlayersCount - teamSize + 1) : totalPlayersCount;

    let maxCardsOrPoints = 108 - (virtualOpponents - 1);
    if (modality === 'Domino') {
      if (virtualOpponents === 2) maxCardsOrPoints = 153;
      else if (virtualOpponents === 3) maxCardsOrPoints = 118;
      else maxCardsOrPoints = 69;
    }

    let totalRemainingTable = 0;
    if (gameMode === 'equipe') {
      const teamSums = {};
      playersList.forEach(p => {
        if (teamSums[p.equipeIndex] === undefined) {
          teamSums[p.equipeIndex] = p.resultado === 'vitoria' ? 0 : (parseInt(p.pecasOuCartas) || 0);
        }
      });
      Object.values(teamSums).forEach(val => totalRemainingTable += val);
    } else {
      playersList.forEach(p => {
        if (p.resultado !== 'vitoria') totalRemainingTable += parseInt(p.pecasOuCartas) || 0;
      });
    }

    const tableFactor = Math.min(1.0, Math.log(1 + totalRemainingTable) / Math.log(1 + maxCardsOrPoints));
    const winnerScore = 0.75 + 0.25 * tableFactor;
    const losersPool = (numTeams / 2) - winnerScore;

    playersList.forEach(p => {
      if (p.resultado === 'vitoria') {
        p.S = winnerScore;
      } else if (p.resultado === 'empate') {
        p.S = 0.5;
      } else {
        if (numTeams === 2) {
          p.S = losersPool;
        } else {
          p.S = losersPool * (1 - ((parseInt(p.pecasOuCartas) || 0) / (totalRemainingTable || 1))) * (1 / (numTeams - 2));
        }
      }
    });

    let rawPerformances = [];
    let sumPerformances = 0;

    playersList.forEach(p => {
      const dbPlayer = playersMap[p.id];
      let sumExpected = 0;
      playersList.forEach(adj => {
        if (adj.id !== p.id) {
          sumExpected += 1 / (1 + Math.pow(10, (playersMap[adj.id].rating - dbPlayer.rating) / 400));
        }
      });
      const expectedIndividual = sumExpected / (totalPlayersCount - 1);
      const rawPerf = p.S - expectedIndividual;
      
      rawPerformances.push(rawPerf);
      sumPerformances += rawPerf;
    });

    const symmetryAdjustment = -sumPerformances / totalPlayersCount;
    const itemLabel = modality === 'Domino' ? 'Pontinhos restantes' : 'Cartas restantes';

    playersList.forEach((p, idx) => {
      const dbPlayer = playersMap[p.id];
      const oldRating = dbPlayer.rating;
      const factorK = Math.max(16, 160 / Math.sqrt(dbPlayer.partidas + 1));
      
      const finalEloDelta = factorK * (rawPerformances[idx] + symmetryAdjustment);
      
      dbPlayer.rating += finalEloDelta;
      dbPlayer.partidas++;

      if (p.resultado === 'vitoria') {
        dbPlayer.vitorias++;
      }

      rows[dbPlayer.rowIndex][2] = dbPlayer.rating;
      rows[dbPlayer.rowIndex][3] = dbPlayer.vitorias;
      rows[dbPlayer.rowIndex][4] = dbPlayer.partidas;

      const teamTag = gameMode === 'equipe' ? ` (Eq ${p.equipeIndex + 1})` : '';
      logDetailsParts.push(`${dbPlayer.nome}${teamTag}: ${p.resultado}, ${itemLabel}: ${p.pecasOuCartas}`);
      eloChanges.push(`${dbPlayer.nome}: ${oldRating} ➔ ${dbPlayer.rating}`);
    });

    logDetails = `Mesa de ${totalPlayersCount} jogadores (${gameMode === 'equipe' ? numTeams + ' equipes' : 'Individual'}). ${logDetailsParts.join('; ')}`;
  } else {
    logDetails = `Mesa de ${playersList.length} jogadores. ${logDetailsParts.join('; ')}`;
  }

  logDetails += ` | Elo: [${eloChanges.join('; ')}]`;

  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);

  registrarLog(user, 'Registro de Partida', modality, involvedNames, logDetails);

  const updatedData = updateModalityCache(modality);
  return responseJSON({ status: 'success', data: updatedData });
}