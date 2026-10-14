/**
 * Gerenciamento de cache em memória e leitura/gravação direta nas planilhas do Google.
 */

function getCachedAppData() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(CACHE_KEY_RANKINGS);
  if (cached) {
    return JSON.parse(cached);
  }
  return fetchAndCacheAllAppData();
}

function getCachedHistory() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(CACHE_KEY_HISTORY);
  if (cached) {
    return JSON.parse(cached);
  }
  return fetchAndCacheAllHistory();
}

function fetchAndCacheAllAppData() {
  const data = getAppDataFromSheet();
  const cache = CacheService.getScriptCache();
  cache.put(CACHE_KEY_RANKINGS, JSON.stringify(data), CACHE_TTL_SECONDS);
  return data;
}

function fetchAndCacheAllHistory() {
  const history = getHistoryFromSheet();
  const cache = CacheService.getScriptCache();
  cache.put(CACHE_KEY_HISTORY, JSON.stringify(history), CACHE_TTL_SECONDS);
  return history;
}

function refreshAllCaches() {
  fetchAndCacheAllAppData();
  fetchAndCacheAllHistory();
}

/**
 * Atualiza apenas o cache da modalidade afetada, evitando varreduras desnecessárias nas outras abas.
 */
function updateModalityCache(modalidade) {
  const cache = CacheService.getScriptCache();
  let cachedData = cache.get(CACHE_KEY_RANKINGS);
  let resultado = cachedData ? JSON.parse(cachedData) : getAppDataFromSheet();
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(modalidade);
  if (sheet) {
    const data = sheet.getDataRange().getValues();
    data.shift();
    resultado.rankings[modalidade] = data.map(row => ({
      id: row[0],
      nome: row[1],
      rating: Math.round(row[2]),
      vitorias: parseInt(row[3]) || 0,
      partidas: parseInt(row[4]) || 0
    }));
  }

  const backupSheet = ss.getSheetByName('Backup_' + modalidade);
  if (backupSheet) {
    const bData = backupSheet.getDataRange().getValues();
    bData.shift();
    resultado.backups[modalidade] = bData.map(row => ({
      id: row[0],
      nome: row[1],
      rating: Math.round(row[2]),
      vitorias: parseInt(row[3]) || 0,
      partidas: parseInt(row[4]) || 0,
      dataExclusao: row[5],
      excluidoPor: row[6]
    }));
  }

  cache.put(CACHE_KEY_RANKINGS, JSON.stringify(resultado), CACHE_TTL_SECONDS);
  cache.remove(CACHE_KEY_HISTORY); // Invalida o cache de histórico para refletir novos logs
  return resultado;
}

function getAppDataFromSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const modalidades = ['Xadrez', 'Damas', 'Domino', 'Uno'];
  let resultado = { rankings: {}, backups: {} };

  modalidades.forEach(mod => {
    const sheet = ss.getSheetByName(mod);
    if (sheet) {
      const data = sheet.getDataRange().getValues();
      data.shift();
      resultado.rankings[mod] = data.map(row => ({
        id: row[0],
        nome: row[1],
        rating: Math.round(row[2]),
        vitorias: parseInt(row[3]) || 0,
        partidas: parseInt(row[4]) || 0
      }));
    }

    const backupSheet = ss.getSheetByName('Backup_' + mod);
    if (backupSheet) {
      const bData = backupSheet.getDataRange().getValues();
      bData.shift();
      resultado.backups[mod] = bData.map(row => ({
        id: row[0],
        nome: row[1],
        rating: Math.round(row[2]),
        vitorias: parseInt(row[3]) || 0,
        partidas: parseInt(row[4]) || 0,
        dataExclusao: row[5] ? Utilities.formatDate(new Date(row[5]), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss") : "",
        excluidoPor: row[6]
      }));
    }
  });

  return resultado;
}

function getHistoryFromSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const modalidades = ['Xadrez', 'Damas', 'Domino', 'Uno'];
  let historyByMod = {};

  modalidades.forEach(mod => {
    historyByMod[mod] = [];
    const sheet = ss.getSheetByName('Historico_' + mod);
    if (sheet) {
      const rows = sheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        historyByMod[mod].push({
          rowIndex: i + 1,
          dataHora: rows[i][0] ? Utilities.formatDate(new Date(rows[i][0]), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss") : "",
          usuario: rows[i][1],
          acao: rows[i][2],
          modalidade: mod,
          envolvidos: rows[i][3],
          detalhes: rows[i][4]
        });
      }
      historyByMod[mod].reverse();
    }
  });

  return historyByMod;
}

function registrarLog(usuario, acao, jogo, jogadoresEnvolvidos, detalhes) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = 'Historico_' + jogo;
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(['DataHora', 'Usuario', 'Acao', 'Jogadores Envolvidos', 'Detalhes']);
  }
  sheet.appendRow([new Date().toLocaleString('pt-BR'), usuario, acao, jogadoresEnvolvidos, detalhes]);
}