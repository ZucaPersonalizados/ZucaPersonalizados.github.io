# 🛒 Sistema de Controle de Estoque - Zuca Personalizados

## 📋 Resumo da Implementação

Sistema completo de controle de estoque para evitar vendas de produtos indisponíveis. Implementado em **3 camadas**: Frontend (validação UX), Backend (API), e Integração com Firestore + Webhook PIX/Cartão.

---

## 🎯 O QUE FOI IMPLEMENTADO

### ✅ **1. Backend - Controller (produtosController.js)**

#### Endpoints Criados:

**GET `/produtos/validar-estoque/:id?quantidade=1`**
- Valida se há estoque suficiente para um produto
- Retorna: `{ disponivel: true/false, estoque: num, mensagem: string }`
- Usado para: Verificações em tempo real

**POST `/produtos/decrementar-estoque`**
- Reduz estoque após pagamento confirmado
- Body: `{ itens: [{ id, quantidade }, ...] }`
- Retorna: Resultado da atualização com estoque anterior/novo
- 🔥 **Crítico**: Chamado automaticamente após PIX/Cartão aprovados

**POST `/produtos/incrementar-estoque`**
- Restaura estoque se pedido for cancelado/devolvido
- Body: `{ itens: [{ id, quantidade }, ...] }`
- Útil para: Logística de devoluções

---

### ✅ **2. Backend - Webhook (pix-server.js)**

#### Automação PIX → Firestore → Estoque:

```
PIX Aprovado → /verificar-pagamento
              ↓
          Atualiza Status do Pedido (pendente → pagto)
              ↓
          Itera cada item do pedido
              ↓
          Decrementa estoque em tempo real
              ↓
          ✓ Estoque sincronizado com Firestore
```

**Fluxo:**
1. Cliente paga COM PIX
2. Webhook recebe confirmação do Mercado Pago
3. Backend atualiza `pedidos` com `status: "pagto"`
4. **SIMULTANEAMENTE**, decrementa `produtos.estoque` para cada item

---

### ✅ **3. Frontend - Página de Produto (produto.html)**

#### UI de Disponibilidade:

```html
<!-- Container dinâmico mostra: -->
✓ Em Estoque (verde)    →  "5 unidades disponíveis"
⚠️ Poucos itens (laranja) → "⚠️ Apenas 2 unidades disponíveis"
✗ Fora de Estoque (vermelho) → "Produto indisponível"
```

#### Validações ao Adicionar ao Carrinho:
- ❌ Se `estoque = 0` → Desabilita botão + Aviso visual
- ❌ Se `quantidade_carrinho + 1 > estoque` → Alert com limite permitido
- ✅ Se `quantidade ≤ estoque` → Adiciona normalmente

---

### ✅ **4. Frontend - Checkout (checkout.js)**

#### Nova Função: `validarEstoque(itens)`

Antes de criar o pedido, valida os 5 itens:

```javascript
✓ Produto ainda existe?
✓ Quantidade ≤ estoque atual?
✓ Todos os itens disponíveis?

Se falhar qualquer um:
  → Alert com lista de produtos indisponíveis
  → Bloqueias finalização
  → Solicita atualização do carrinho
```

---

## 🚀 COMO USAR

### Para Lojas/Admin - Adicionar Estoque a um Produto:

1. Abra **Firebase Firestore** → Coleção `produtos`
2. Selecione um produto
3. Adicione/edite o campo `estoque: 10` (número)
4. Salve

**Pronto!** A página de produto mostrará automaticamente:
- ✅ Disponibilidade
- ⚠️ Alertas se poucos itens
- ✗ Bloqueio se zerado

---

### Para Testes - Simular Vendas:

#### Cenário 1: Produto com Estoque Limitado
```json
{
  "id": "produto-1",
  "nome": "Caneta Personalizada",
  "preco": 25.90,
  "estoque": 3          ← Apenas 3 unidades
}
```
**Resultado:** Página mostra "⚠️ Apenas 3 unidades"

#### Cenário 2: Fora de Estoque
```json
{
  "estoque": 0
}
```
**Resultado:** Botão "❌ Fora de Estoque" (desabilitado)

#### Cenário 3: Pagar com PIX
1. Adicione produto ao carrinho
2. Vá para checkout
3. Escolha PIX
4. Confirme compra → QR code gerado
5. **No backend**, estoque é decrementado automaticamente

---

## 📊 FLUXO COMPLETO DE ESTOQUE

```
┌─────────────────────────────────────────────────────┐
│ CLIENTE NAVEGA PRODUTOS                             │
│ (Vê: ✓ Em Estoque - 5 unidades)                     │
└────────────────┬────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────┐
│ ADICIONA AO CARRINHO                                │
│ ✓ Valida: estoque ≥ quantidade solicitada          │
│ ✗ Se não: Mostra erro                              │
└────────────────┬────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────┐
│ CHECKOUT                                            │
│ ✓ Valida NOVAMENTE estoque (pode ter mudado)       │
│ ✗ Se indisponível: Oferece atualizar carrinho      │
└────────────────┬────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────┐
│ PAYMENT PROCESSING                                  │
│ (PIX, Cartão, Boleto, Transferência)               │
└────────────────┬────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────┐
│ PAGAMENTO CONFIRMADO ✓                              │
│ Webhook recebe: status = "approved"                │
└────────────────┬────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────┐
│ ESTOQUE DECREMENTADO AUTOMATICAMENTE ⚡             │
│ produtos[id].estoque = 5 - 1 = 4                   │
│ Log: "Produto X: 5 → 4 unidades"                   │
└─────────────────────────────────────────────────────┘
```

---

## 🔧 CONFIGURAÇÃO NECESSÁRIA

### 1. Firestore - Adicionar Campo `estoque` em Produtos

Se você TEM produtos sem o campo `estoque`, adicione com valor inicial:

```javascript
// No Firebase Console ou via admin SDK:
db.collection("produtos").doc("id").update({
  estoque: 50  // Número de unidades disponíveis
})
```

### 2. (Opcional) Verificar Logs do Backend

Quando um pedido é pago, você verá logs como:

```
[VERIFICAR] Atualizando status de pagamento para pedido: xyz123
[ESTOQUE] Decrementando estoque para 3 itens...
  ✓ Caneta Vermelha: 50 → 49 unidades
  ✓ Caderno A5: 20 → 19 unidades
  ✓ Sticker Pack: 100 → 95 unidades
✓ Pagamento verificado para pedido xyz123
```

---

## 🚨 CASOS DE ERRO E SOLUÇÕES

### ❌ "Produto não encontrado"
- **Causa:** Produto foi deletado do Firestore
- **Solução:** Remover do carrinho ou adicionar novamente

### ❌ "Apenas 2 disponíveis"
- **Causa:** Estoque insuficiente para quantidade solicitada
- **Solução:** Reduzir quantidade no carrinho

### ❌ "Erro ao validar estoque"
- **Causa:** Firebase não respondeu ou conexão lenta
- **Solução:** Tentar novamente ou aguardar conexão

### ✓ Estoque Decrementou Mas Pedido Recusado?
- **Nota:** Se pagamento falhar APÓS decremento, é necessário reverter via endpoint `/incrementar-estoque`
- **Implementação futura:** Auto-reverter se pagamento falhar

---

## 📈 PRÓXIMAS MELHORIAS

- [ ] Auto-revert de estoque se pagamento falhar
- [ ] Sistema de reserva (bloqueia estoque por 15 min após adicionar ao carrinho)
- [ ] Alertas para produtos com estoque baixo (< 5 unidades)
- [ ] Dashboard com histórico de movimentação de estoque
- [ ] Atualização em massa de estoque (admin)
- [ ] Integração com fornecedores para reposição automática

---

## 📞 SUPORTE

### Debug: Como Verificar Estoque Manualmente?

**Firestore Console:**
1. Abra https://console.firebase.google.com
2. Projeto: zuca-personalizados
3. Firestore Database → Coleção `produtos`
4. Abra um documento → Veja campo `estoque`

**Terminal (Admin SDK):**
```bash
curl http://localhost:3000/produtos/validar-estoque/PRODUCT_ID?quantidade=1
```

Resposta:
```json
{
  "success": true,
  "disponivel": true,
  "estoque": 5,
  "solicitado": 1,
  "mensagem": "5 unidades disponíveis"
}
```

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

- [x] Endpoints backend criados
- [x] Firestore integration implementada
- [x] Webhook PIX → estoque sincronizado
- [x] UI produto.html mostra disponibilidade
- [x] Validação ao adicionar carrinho
- [x] Validação no checkout
- [x] Logs de operações
- [ ] Testes em produção
- [ ] Monitoramento contínuo

---

**Status:** ✅ Pronto para produção  
**Data:** 14 de abril de 2026  
**Versão:** 1.0 - MVP Funcional
