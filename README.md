# Sistema de Gerenciamento de Ranking de Jogos de Tabuleiro (FJU Esportes)

Sistema web completo para gerenciamento de rankings Elo, histórico de partidas, lixeira (backup) e auditoria de ações, desenvolvido com um front-end moderno hospedado no GitHub Pages e um back-end serverless integrado ao Google Apps Script com banco de dados no Google Sheets.

## 🚀 Tecnologias Utilizadas

- **Front-end:** HTML5, CSS3, JavaScript (Vanilla ES6+)
- **Back-end:** Google Apps Script (JavaScript V8)
- **Banco de Dados:** Google Sheets
- **Hospedagem:** GitHub Pages

---

## 📋 Configuração do Google Sheets (Banco de Dados)

Para que o back-end do Google Apps Script consiga ler e gravar os dados corretamente, a sua planilha do Google deve seguir estritamente a estrutura de abas e colunas descrita abaixo.

### 1. Abas de Jogadores e Ranking (Para cada modalidade)
O sistema foi projetado para gerenciar quatro modalidades principais: **Xadrez**, **Damas**, **Domino** e **Uno**. Cada modalidade exige duas abas na planilha: a aba ativa (com o nome exato da modalidade) e a aba de lixeira/backup (`Backup_` seguido do nome da modalidade).

* **Abas ativas:** `Xadrez`, `Damas`, `Domino`, `Uno`
* **Abas de Backup:** `Backup_Xadrez`, `Backup_Damas`, `Backup_Domino`, `Backup_Uno`

**Cabeçalhos obrigatórios (Linha 1) para as abas de Ranking:**
| Coluna A | Coluna B | Coluna C | Coluna D | Coluna E |
| :--- | :--- | :--- | :--- | :--- |
| ID | Nome | Rating | Vitorias | Partidas |

**Cabeçalhos obrigatórios (Linha 1) para as abas de Backup:**
| Coluna A | Coluna B | Coluna C | Coluna D | Coluna E | Coluna F | Coluna G |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| ID | Nome | Rating | Vitorias | Partidas | DataExclusao | ExcluidoPor |

---

### 2. Abas de Histórico de Auditoria
Para cada modalidade, existe uma aba destinada ao registro de log de partidas e alterações administrativas.

* **Nomes das abas:** `Historico_Xadrez`, `Historico_Damas`, `Historico_Domino`, `Historico_Uno`

**Cabeçalhos obrigatórios (Linha 1):**
| Coluna A | Coluna B | Coluna C | Coluna D | Coluna E |
| :--- | :--- | :--- | :--- | :--- |
| DataHora | Usuario | Acao | Jogadores Envolvidos | Detalhes |

---

### 3. Aba de Sessões e Autenticação
O sistema gerencia tokens de login persistentes em uma aba dedicada (que pode ser mantida oculta na planilha).

* **Nome da aba:** `_Sessoes`

**Cabeçalhos obrigatórios (Linha 1):**
| Coluna A | Coluna B | Coluna C | Coluna D |
| :--- | :--- | :--- | :--- |
| Token | Username | Role | ExpirationISO |

---

## 🔒 Configuração de Segurança e Credenciais

Este repositório utiliza uma estratégia de proteção para evitar o vazamento de hashes de senhas e dados de administradores. 

1. O arquivo real de credenciais do back-end (`Usuarios.gs`) fica restrito localmente e é ignorado pelo Git através do arquivo `.gitignore`.
2. Para configurar o projeto em um novo ambiente, utilize o arquivo de modelo `Usuarios.example.gs` localizado na pasta do Apps Script como referência para estruturar seus usuários na nuvem do Google.

---

## 📦 Como Instalar e Executar

1. Clone este repositório em sua máquina local.
2. Configure a sua planilha do Google Sheets com as abas e cabeçalhos detalhados acima.
3. Publique os arquivos `.gs` na sua ferramenta de projetos do Google Apps Script vinculada à planilha e obtenha a URL de implantação do Web App.
4. Insira a URL do Web App no arquivo `js/api.js` do front-end.
5. Suba o projeto para um repositório no GitHub e ative o GitHub Pages nas configurações do repositório.