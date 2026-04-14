# Zuca Personalizados - E-commerce

Sistema de e-commerce completo com pagamentos PIX e Cartão de Crédito.

## 🚀 Início Rápido

### 1. Instalar dependências
```bash
npm install
```

### 2. Configurar credenciais (`.env`)
Copie `.env.example` para `.env`:
```bash
cp .env.example .env
```

Edite `.env` com suas credenciais do Mercado Pago:
```
MP_ACCESS_TOKEN=seu_token
MP_PUBLIC_KEY=sua_chave_publica
PORT=3000
```

### 3. Iniciar o servidor
```bash
npm run dev
```

### 4. Executar o frontend
Em outro terminal:
```bash
cd frontend-zuca
python3 -m http.server 8000
```

Acesse: `http://localhost:8000`

## 📁 Estrutura

```
├── src/                    # Backend Node.js
│   ├── pix-server.js      # Servidor PIX + Mercado Pago
│   ├── firebase.js        # Configuração Firebase
│   └── config/            # Configurações
├── frontend-zuca/          # Frontend esático
│   ├── index.html         # Home
│   ├── checkout.html      # Checkout
│   ├── admin.html         # Painel admin
│   ├── js/                # JavaScript
│   └── css/               # Estilos
├── package.json           # Dependências
└── .env.example          # Template de configuração
```

## 🔐 Admin

- Acesse: `http://localhost:8000/admin.html`
- Email: `willianzucareli@gmail.com`
- Senha: Configure via "Esqueci minha senha" (Firebase)

## 💳 Métodos de Pagamento

- **PIX Dinâmico** - QR Code gerado automaticamente
- **Cartão de Crédito** - Via Mercado Pago
- **Boleto** - Framework pronto
- **Transferência Bancária** - Framework pronto

## 🔧 Tecnologias

- **Backend:** Node.js v20, Express, Mercado Pago API
- **Frontend:** HTML5, CSS3, JavaScript vanilla
- **Banco de dados:** Firebase Firestore
- **Autenticação:** Firebase Auth

## 💳 Configuração Mercado Pago

Para integração completa de pagamentos com cartão:

1. Acesse: https://www.mercadopago.com.br/developers/panel
2. Copie suas credenciais (Access Token + Public Key)
3. Cole no arquivo `.env`
4. Reinicie o servidor

Veja [MERCADO_PAGO_SETUP.md](./MERCADO_PAGO_SETUP.md) para detalhes completos e credenciais de teste.
