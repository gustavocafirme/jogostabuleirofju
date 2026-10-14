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
  const appData = getAppDataFromSheet();
  const cache = CacheService.getScriptCache();
  cache.put(CACHE_KEY_RANKINGS, JSON.stringify(appData), CACHE_TTL_SECONDS);
  return appData;
}

function fetchAndCacheAllHistory() {
  const historyData = getHistoryFromSheet();
  const cache = CacheService.getScriptCache();
  cache.put(CACHE_KEY_HISTORY, JSON.stringify(historyData), CACHE_TTL_SECONDS);
  return historyData;
}

function refreshAllCaches() {
  fetchAndCacheAllAppData();
  fetchAndCacheAllHistory();
}

/**
 * Atualiza apenas o cache da modalidade afetada, evitando varreduras desnecessárias nas outras abas.
 */
function updateModalityCache(modality) {
  const cache = CacheService.getScriptCache();
  let cachedData = cache.get(CACHE_KEY_RANKINGS);
  let result = cachedData ? JSON.parse(cachedData) : getAppDataFromSheet();
  
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(modality);
  if (sheet) {
    const sheetData = sheet.getDataRange().getValues();
    sheetData.shift();
    result.rankings[modality] = sheetData.map(row => ({
      id: row[0],
      nome: row[1],
      rating: Math.round(row[2]),
      vitorias: parseInt(row[3]) || 0,
      partidas: parseInt(row[4]) || 0
    }));
  }

  const backupSheet = spreadsheet.getSheetByName('Backup_' + modality);
  if (backupSheet) {
    const backupData = backupSheet.getDataRange().getValues();
    backupData.shift();
    result.backups[modality] = backupData.map(row => ({
      id: row[0],
      nome: row[1],
      rating: Math.round(row[2]),
      vitorias: parseInt(row[3]) || 0,
      partidas: parseInt(row[4]) || 0,
      dataExclusao: row[5] ? Utilities.formatDate(new Date(row[5]), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss") : "",
      excluidoPor: row[6]
    }));
  }

  cache.put(CACHE_KEY_RANKINGS, JSON.stringify(result), CACHE_TTL_SECONDS);
  cache.remove(CACHE_KEY_HISTORY); // Invalida o cache de histórico para refletir novos logs
  return result;
}

function getAppDataFromSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const modalities = ['Xadrez', 'Damas', 'Domino', 'Uno'];
  let result = { rankings: {}, backups: {} };

  modalities.forEach(mod => {
    const sheet = spreadsheet.getSheetByName(mod);
    if (sheet) {
      const sheetData = sheet.getDataRange().getValues();
      sheetData.shift();
      result.rankings[mod] = sheetData.map(row => ({
        id: row[0],
        nome: row[1],
        rating: Math.round(row[2]),
        vitorias: parseInt(row[3]) || 0,
        partidas: parseInt(row[4]) || 0
      }));
    }

    const backupSheet = spreadsheet.getSheetByName('Backup_' + mod);
    if (backupSheet) {
      const backupData = backupSheet.getDataRange().getValues();
      backupData.shift();
      result.backups[mod] = backupData.map(row => ({
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

  return result;
}

function getHistoryFromSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const modalities = ['Xadrez', 'Damas', 'Domino', 'Uno'];
  let historyByMod = {};

  modalities.forEach(mod => {
    historyByMod[mod] = [];
    const sheet = spreadsheet.getSheetByName('Historico_' + mod);
    if (sheet) {
      const rows = sheet.getDataRange().getValues();
      const header = rows.shift(); 
      
      if (rows.length > 0) {
        historyByMod[mod] = rows.map((row, index) => ({
          rowIndex: index + 2,
          dataHora: row[0] ? Utilities.formatDate(new Date(row[0]), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss") : "",
          usuario: row[1],
          acao: row[2],
          modalidade: mod,
          envolvidos: row[3],
          detalhes: row[4]
        })).reverse();
      }
    }
  });

  return historyByMod;
}

function registrarLog(user, action, game, involvedPlayers, details) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = 'Historico_' + game;
  let sheet = spreadsheet.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    sheet.appendRow(['DataHora', 'Usuario', 'Acao', 'Jogadores Envolvidos', 'Detalhes']);
  }
  sheet.appendRow([new Date().toLocaleString('pt-BR'), user, action, involvedPlayers, details]);
}