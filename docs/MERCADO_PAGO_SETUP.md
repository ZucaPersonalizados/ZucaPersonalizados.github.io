# Configuração Mercado Pago 🛒

## Passo 1: Obtenha suas credenciais

1. Acesse: https://www.mercadopago.com.br/developers/panel
2. Faça login ou crie uma conta
3. Vá em **Credenciais**
4. Copie:
   - **Access Token** (começa com `APP_USR-`)
   - **Public Key** (também começa com `APP_USR-`)

## Passo 2: Configure o .env

Na raiz do projeto (`/backend-zuca/.env`), adicione:

```env
# Credenciais do Mercado Pago
MP_ACCESS_TOKEN=APP_USR-seu_access_token_long_aqui
MP_PUBLIC_KEY=APP_USR-sua_public_key_aqui

# Ambiente (local/staging/production)
NODE_ENV=local
PORT=3000
```

## Passo 3: Inicie o servidor

```bash
npm run dev
```

Você deve ver:
```
[MP] Inicializado com sucesso
[PIX] Servidor PIX rodando
```

## Passo 4: Teste o checkout

1. Abra: `http://localhost:8000/checkout.html`
2. Selecione **Cartão de Crédito**
3. O formulário Mercado Pago deve aparecer
4. Use cartão de teste: **4111 1111 1111 1111** (Visa de teste)

## Credenciais de Teste Mercado Pago

**Cartão Visa de Teste:**
- Número: `4111 1111 1111 1111`
- Vencimento: `11/25`
- CVV: `123`
- Titular: Qualquer nome

**Cartão Mastercard de Teste:**
- Número: `5555 4444 3333 1111`
- Vencimento: `11/25`
- CVV: `123`

## Endpoints Úteis

- **GET** `/health` → Verifica se servidor está rodando
- **GET** `/config-mercadopago` → Retorna chave pública para frontend
- **POST** `/gerar-pix` → Gera PIX dinâmico
- **POST** `/processar-pagamento` → Processa cartão
- **POST** `/webhook-pix` → Webhook para confirmação PIX

## Troubleshooting

### Erro: "Chave pública não configurada"
- Verifique se `.env` tem `MP_PUBLIC_KEY`
- Reinicie o servidor: `npm run dev`

### Erro 401 no Mercado Pago
- Verifique se `MP_ACCESS_TOKEN` está correto
- Certifique-se de estar usando credenciais da PRODUCTION se em produção

### Cartão recusado
- Use os números de teste acima
- Na produção, use cartões reais
