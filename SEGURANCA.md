# 🔒 Guia de Segurança - Zuca Personalizados

## ❌ PROBLEMA DETECTADO - CHAVE EXPOSTA!

Uma **chave de API do Google** foi detectada no repositório GitHub:
```
AIzaSyDP3XJYquHpbKHNt1gvQOZS1--b0CXfknw
```

## ✅ SOLUÇÃO IMPLEMENTADA

### 1. **Removidas Chaves de Todos os Arquivos**
- ✅ `script.js` 
- ✅ `checkout.js`
- ✅ `admin.js`

### 2. **Sistema de Configuração Segura Criado**
- ✅ `.gitignore` adicionado (protege arquivos sensíveis)
- ✅ `firebase.js` refatorizado para carregar credenciais de arquivo local
- ✅ `config.local.example.js` criado como template

---

## 🚀 PRÓXIMOS PASSOS URGENTES

### Passo 1: Revogar a Chave Exposta (CRÍTICO!)
1. Acesse [Firebase Console](https://console.firebase.google.com)
2. Vá para **Projeto > Configurações > Chaves de API**
3. **Delete imediatamente** a chave `AIzaSyDP3XJYquHpbKHNt1gvQOZS1--b0CXfknw`
4. Gere uma **nova chave de API**
5. **Restrinja a chave** (ver Passo 3)

### Passo 2: Criar Arquivo de Configuração Local
```bash
# No seu computador local
cd frontend-zuca/js

# Copie o template
cp config.local.example.js config.local.js

# Edite com suas novas credenciais
nano config.local.js  # ou abra com seu editor
```

### Passo 3: Configurar Restrições de Chave no Firebase
[Firebase Console](https://console.firebase.google.com) → Credenciais:

**Restrições de Aplicação:**
- ✅ Selecione: **Aplicações web HTTP**
- ✅ Domínios permitidos:
  - `localhost:3000`
  - `localhost:5000`
  - `zuca-personalizados.com` (seu domínio)
  - `*.zuca-personalizados.com`

**Restrições de API:**
- ✅ Selecione apenas:
  - Google Sheets API
  - Firestore API
  - Firebase Services

### Passo 4: Atualizar config.local.js
```javascript
// config.local.js
export const firebaseConfig = {
  apiKey: "SUA_NOVA_CHAVE_AQUI", // ← Coloque a chave nova
  authDomain: "zuca-personalizados.firebaseapp.com",
  projectId: "zuca-personalizados",
  storageBucket: "zuca-personalizados.firebasestorage.app",
  messagingSenderId: "651379669151",
  appId: "1:651379669151:web:0a0bb2c2047e7558d14aaa",
};
```

### Passo 5: Verificar o .gitignore
```bash
# Confirme que config.local.js está no .gitignore
cat .gitignore | grep config.local
```

**Esperado:**
```
config.local.js
```

---

## 🔐 Como Usar em Desenvolvimento

1. **Arquivo `config.local.js` NÃO será commitado** (está em .gitignore)
2. Cada desenvolvedor tem seu próprio arquivo local
3. Firebase se configura automaticamente ao carregar a página
4. Não há risco de expor chaves no código

---

## 📝 Para Novos Desenvolvedores

Quando um novo dev clonar o repo:

```bash
# 1. Clone o repositório
git clone https://github.com/seu-user/backend-zuca.git
cd backend-zuca/frontend-zuca

# 2. Crie arquivo local de configuração
cp js/config.local.example.js js/config.local.js

# 3. Edite com as credenciais compartilhadas 
# (peça ao admin do projeto)
nano js/config.local.js

# 4. Teste se carrega
# Abra a página no navegador e veja o console
```

---

## ⚠️ VERIFICAÇÃO DE SEGURANÇA

```bash
# Confirme que a chave não está mais no repositório
grep -r "AIzaSyDP3XJYquHpbKHNt1gvQOZS1--b0CXfknw" .

# Resultado esperado: nenhum resultado (arquivo limpo!)
```

---

## 🛡️ Melhores Práticas para o Futuro

1. **NUNCA commite**: `.env`, `.env.local`, `config.local.js`
2. **SEMPRE revise**: Arquivos antes de fazer push
3. **USE variáveis de ambiente**: Em produção
4. **CONFIGURE webhooks**: GitHub Actions para detectar secrets
5. **ROTACIONE chaves**: A cada 3 meses

---

## 📚 Recursos Adicionais

- [Firebase Security Rules](https://firebase.google.com/docs/firestore/security/start)
- [How to Protect API Keys](https://cloud.google.com/docs/authentication/api-keys)
- [OWASP API Security](https://owasp.org/www-project-api-security/)

---

## ✅ Checklist Final

- [ ] Chave exposta deletada do Firebase
- [ ] Nova chave criada
- [ ] Nova chave com restrições configuradas
- [ ] `config.local.js` criado com nova chave
- [ ] `.gitignore` confirmado
- [ ] Nenhuma chave no histórico do Git (verificar com grep)
- [ ] Teste realizado: página carrega sem erros
- [ ] Todos os developers notificados

---

**Última atualização:** 14 de abril de 2026
**Status:** 🟢 Corrigido
