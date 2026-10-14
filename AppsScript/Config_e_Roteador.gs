/**
 * Configurações globais de cache e roteamento de requisições HTTP (doGet e doPost).
 */

const CACHE_KEY_RANKINGS = 'APP_DATA_RANKINGS';
const CACHE_KEY_HISTORY = 'APP_DATA_HISTORY';
const CACHE_TTL_SECONDS = 21600; // 6 horas

/**
 * Ponto de entrada para requisições GET (consulta de histórico e dados).
 */
function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'getHistory') {
    const token = e.parameter.token;
    const session = getValidSession(token);
    if (!session || session.role !== 'admin') {
      return responseJSON({ status: 'error', message: 'Acesso negado ao histórico.' });
    }
    return responseJSON({ history: getCachedHistory() });
  }
  return responseJSON(getCachedAppData());
}

/**
 * Ponto de entrada para requisições POST (login, CRUD de jogadores e registro de partidas).
 */
function doPost(e) {
  let params = {};
  try {
    params = JSON.parse(e.postData.contents);
  } catch (err) {
    return responseJSON({ status: 'error', message: 'Payload JSON inválido' });
  }

  const action = params.action;

  if (action === 'login') {
    return handleLogin(params.username, params.password, params.remember);
  }

  const sessionToken = params.token;
  const session = getValidSession(sessionToken);

  if (!session) {
    return responseJSON({ status: 'error', message: 'Sessão expirada ou inválida. Por favor, faça login novamente.' });
  }

  const usuario = session.username;
  const role = session.role;

  if (action === 'addPlayer') {
    if (role !== 'admin' && role !== 'subadmin') {
      return responseJSON({ status: 'error', message: 'Sem permissão para adicionar jogadores.' });
    }
    return handleAddPlayer(params.modalidade, params.nome, usuario);
  } else if (action === 'deletePlayer') {
    if (role !== 'admin') {
      return responseJSON({ status: 'error', message: 'Sem permissão para excluir jogadores.' });
    }
    return handleDeletePlayer(params.modalidade, params.playerId, usuario);
  } else if (action === 'restorePlayer') {
    if (role !== 'admin') {
      return responseJSON({ status: 'error', message: 'Sem permissão para restaurar jogadores.' });
    }
    return handleRestorePlayer(params.modalidade, params.playerId, usuario);
  } else if (action === 'recordMatch') {
    if (role !== 'admin' && role !== 'subadmin' && role !== 'auxiliar') {
      return responseJSON({ status: 'error', message: 'Sem permissão para registrar partidas.' });
    }
    return handleRecordMatch(params, usuario);
  } else if (action === 'getHistory') {
    if (role !== 'admin') {
      return responseJSON({ status: 'error', message: 'Sem permissão para visualizar histórico.' });
    }
    return responseJSON({ history: getCachedHistory() });
  }

  return responseJSON({ status: 'error', message: 'Ação inválida' });
}

/**
 * Utilitário para padronizar respostas em formato JSON.
 */
function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}