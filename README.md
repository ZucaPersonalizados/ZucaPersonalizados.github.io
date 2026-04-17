# Zuca Personalizados

Projeto reorganizado em arquitetura separada por responsabilidades:

- `backend/`: API, autenticação admin, integração Mercado Pago e acesso ao Firebase Admin SDK.
- `frontend/`: páginas públicas e painel admin em HTML/CSS/JS (sem SDK Firebase no navegador).
- `docs/`: documentação operacional e segurança.

## Estrutura

```text
backend-zuca/
  backend/
    .env.example
    package.json
    src/
      app-server.js
      firebase.js
      controllers/
      routes/
      config/
  frontend/
    index.html
    produto.html
    checkout.html
    admin.html
    css/
    js/
    img/
  docs/
    SEGURANCA.md
    MERCADO_PAGO_SETUP.md
    ...
```

## Requisitos

- Node.js 20+
- Credenciais Firebase Admin (arquivo local ou variável `FIREBASE_SERVICE_ACCOUNT_JSON`)
- Credenciais Mercado Pago

## Configuração

1. Instale dependências:

```bash
cd backend
nvm use
npm install
```

2. Configure variáveis de ambiente:

```bash
cp .env.example .env
```

3. Preencha no `backend/.env`:

- `FIREBASE_KEY_PATH=./src/config/firebase-key.json`
- `FIREBASE_SERVICE_ACCOUNT_JSON={...}` (recomendado no Render)
- `MP_ACCESS_TOKEN=...`
- `MP_PUBLIC_KEY=...`
- `ADMIN_EMAIL=...`
- `ADMIN_PASSWORD=...`
- `CORS_ORIGINS=http://localhost:3000,http://localhost:8000,https://zuca-personalizados.onrender.com,https://zucapersonalizados.com.br,https://www.zucapersonalizados.com.br`

## Execução

No backend:

```bash
cd backend
npm run dev
```

Servidor padrão: `http://localhost:3000`

### Rotas úteis

- Frontend (servido pelo backend):
  - `http://localhost:3000/`
  - `http://localhost:3000/produto`
  - `http://localhost:3000/checkout`
  - `http://localhost:3000/admin`
- Healthcheck:
  - `GET /health`

## Padrões adotados

- Separação por camadas (`controllers`, `routes`, `server`).
- Frontend desacoplado de credenciais e SDK Firebase.
- Segredos apenas no backend (`.env`, chave de serviço).
- Sessão admin via cookie HttpOnly no backend.
