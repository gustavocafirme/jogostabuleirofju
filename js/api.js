const API_URL = "https://script.google.com/macros/s/AKfycbyvYdylsWuc0kjufyfrg9CB_pgf2LUUcNRss5gCmu50BeRi1ylv3pkR1WilvReHzWafuw/exec";

async function fetchAppData() {
  const res = await fetch(API_URL);
  return await res.json();
}

async function fetchHistoryData(token) {
  const res = await fetch(`${API_URL}?action=getHistory&token=${token}`);
  return await res.json();
}

async function postAction(payload) {
  console.log("📤 [DEBUG api.js] Enviando payload:", payload);
  
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify(payload)
  });

  const rawText = await res.text();
  console.log("📥 [DEBUG api.js] Resposta bruta recebida do Apps Script:", rawText);

  try {
    return JSON.parse(rawText);
  } catch (e) {
    console.error("❌ [DEBUG api.js] O Apps Script retornou uma resposta que não é JSON válido (geralmente erro 500 em HTML):", rawText);
    throw new Error("Erro no servidor do Apps Script (verifique o console para ver o HTML do erro).");
  }
}