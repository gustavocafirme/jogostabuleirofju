/**
 * Gerenciamento de autenticação de usuários, hash de senhas e persistência de sessões.
 */

function handleLogin(username, passwordText, remember) {
  if (!username || !passwordText) {
    return responseJSON({ status: 'error', message: 'Preencha usuário e senha.' });
  }

  const passMd5 = computeMD5(passwordText);
  const user = USERS_DB.find(u => u.username.toLowerCase() === username.trim().toLowerCase() && u.passMd5 === passMd5);

  if (!user) {
    return responseJSON({ status: 'error', message: 'Usuário ou senha incorretos!' });
  }

  const now = new Date();
  const durationDays = remember ? 180 : 0.25;
  const expirationDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

  const token = Utilities.getUuid();
  saveSession(token, user.username, user.role, expirationDate);

  return responseJSON({
    status: 'success',
    token: token,
    user: {
      username: user.username,
      role: user.role
    }
  });
}

function computeMD5(input) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, input, Utilities.Charset.UTF_8);
  return digest.map(byte => (byte < 0 ? byte + 256 : byte).toString(16).padStart(2, '0')).join('');
}

function getSessionSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('_Sessoes');
  if (!sheet) {
    sheet = ss.insertSheet('_Sessoes');
    sheet.appendRow(['Token', 'Username', 'Role', 'ExpirationISO']);
    sheet.hideSheet();
  }
  return sheet;
}

function saveSession(token, username, role, expirationDate) {
  const sheet = getSessionSheet();
  sheet.appendRow([token, username, role, expirationDate.toISOString()]);
}

function getValidSession(token) {
  if (!token) return null;

  const sheet = getSessionSheet();
  const data = sheet.getDataRange().getValues();
  const now = new Date();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === token) {
      const expiration = new Date(data[i][3]);
      if (now < expiration) {
        return {
          username: data[i][1],
          role: data[i][2]
        };
      } else {
        sheet.deleteRow(i + 1);
        return null;
      }
    }
  }
  return null;
}