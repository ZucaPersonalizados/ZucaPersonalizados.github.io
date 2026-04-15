# ⚙️ SETUP RÁPIDO: Controle de Estoque

## 1️⃣ ATIVAR NO FIRESTORE

Seus produtos PRECISAM ter o campo `estoque`. Se não tiverem, adicione agora:

### Via Firebase Console (Manual)

```
1. Abra: https://console.firebase.google.com
2. Projeto: zuca-personalizados
3. Firestore Database
4. Coleção: produtos
5. Abra um documento → Clique em "Adicionar campo"
   - Nome: estoque
   - Tipo: Número
   - Valor: 50 (ou a quantidade que desejar)
```

**Faça isso para TODOS os seus produtos!**

---

## 2️⃣ ROTAS API (Para Integração)

Se você usa postman, curl ou qualquer cliente HTTP:

### Validar Estoque
```bash
GET http://localhost:3000/produtos/validar-estoque/PRODUCT_ID?quantidade=1
```

**Resposta:**
```json
{
  "success": true,
  "disponivel": true,
  "estoque": 50,
  "solicitado": 1,
  "mensagem": "50 unidades disponíveis"
}
```

### Decrementar (Após Pagamento)
```bash
POST http://localhost:3000/produtos/decrementar-estoque
Content-Type: application/json

{
  "itens": [
    { "id": "produto-1", "quantidade": 2 },
    { "id": "produto-2", "quantidade": 1 }
  ]
}
```

**Resposta:**
```json
{
  "success": true,
  "atualizacoes": [
    {
      "id": "produto-1",
      "sucesso": true,
      "estoqueAnterior": 50,
      "estoqueNovo": 48
    }
  ]
}
```

### Incrementar (Se Cancelar)
```bash
POST http://localhost:3000/produtos/incrementar-estoque
Content-Type: application/json

{
  "itens": [
    { "id": "produto-1", "quantidade": 1 }
  ]
}
```

---

## 3️⃣ DADOS DE TESTE

Use este JSON para adicionar um produto COM estoque:

```json
{
  "nome": "Caneta Personalizada - Azul",
  "categoria": "Canetas",
  "tipo": "Personalizada",
  "preco": 25.90,
  "descricaoCurta": "Caneta azul de tinta permanente, ideal para personalizações.",
  "descricaoLonga": "Caneta personalizada de alta qualidade com tinta permanente. Perfeita para marca, logo ou texto personalizado.",
  "tamanho": "14cm",
  "gramatura": "Standard",
  "personalizado": true,
  "imagens": [
    "https://via.placeholder.com/500?text=Caneta+Azul"
  ],
  "estoque": 50,
  "criado_em": "2026-04-14T10:00:00Z"
}
```

---

## 4️⃣ TESTE MANUAL DO FLUXO

### Passo 1: Abrir Página de Produto
```
http://seu-dominio.com/produto.html?id=PRODUTO_ID
```
✅ Deve aparecer: "✓ Em Estoque - 50 unidades disponíveis"

### Passo 2: Adicionar ao Carrinho 5x
- Clique no botão "🛒 Adicionar ao carrinho"
- Se conseguir adicionar 5 (máximo 50 disponíveis), OK!
- Na 6ª tentativa, deve mostrar erro: "Máximo de 50 unidades"

### Passo 3: Checkout
- Vá para checkout
- Se estoque mudou em outro navegador, deve avisar
- Finalize a compra com PIX

### Passo 4: Verificar Estoque no Firestore
```
Firestore → produtos → [produto-id]
Veja: estoque = 45 (diminuiu de 50)
```
✅ **SUCESSO!** Estoque foi decrementado!

---

## 5️⃣ SOLUÇÃO DE PROBLEMAS

### Problema: UI não mostra estoque
**Solução:**
1. Abre DevTools (F12)
2. Console → Vê erros?
3. Verifique se o campo `estoque` existe no Firestore para este produto
4. Recarregue a página

### Problema: Estoque não decrementou após pagamento
**Solução:**
1. Verifique webhook: `POST http://localhost:3000/verificar-pagamento`
2. Veja logs do servidor
3. Confirme que o pedido tem `status: "pagto"` no Firestore

### Problema: Checkout valida mas estoque mudou
**Solução:** ✅ Normal! Alguém comprou enquanto estava no checkout. Volte e tente novamente.

---

## 6️⃣ MONITORAR EM PRODUÇÃO

### Logs Esperados:
```
[ESTOQUE] Decrementando estoque para 3 itens...
  ✓ Caneta Vermelha: 50 → 49 unidades
  ✓ Caderno A5: 20 → 19 unidades
  ✓ Sticker Pack: 100 → 99 unidades
✓ Pagamento verificado para pedido xyz123
```

Se VER isso → Está funcionando! 🎉

---

## 🎯 RESUMO

| O que | Onde | Como |
|------|------|------|
| Ver estoque do cliente | produto.html | "✓ Em Estoque - X unidades" |
| Validar no checkout | checkout.js | Função `validarEstoque()` |
| Decrementar estoque | pix-server.js | `/verificar-pagamento` webhook |
| Adicionar campo | Firestore | Manual no console |
| Testar API | Postman/curl | GET `/validar-estoque/:id` |

---

**Próximo passo:** Uma vez que tudo está testando bem localmente, você pode:
1. Fazer deploy no Firebase Hosting (frontend)
2. Deploy do backend (Node.js) em servidor/Heroku/Cloud Run
3. Ativar webhooks real do Mercado Pago
4. Começar a vender! 🚀
