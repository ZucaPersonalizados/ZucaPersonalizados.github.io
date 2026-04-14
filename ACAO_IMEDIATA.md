# 🚨 AÇÃO IMEDIATA - Incidente de Segurança

## STATUS: ⚠️ CRÍTICO - CHAVE EXPOSTA NO GITHUB

**Data do Incidente:** 14 de abril de 2026  
**Chave Comprometida:** `AIzaSyDP3XJYquHpbKHNt1gvQOZS1--b0CXfknw`  
**Severidade:** 🔴 CRÍTICA

---

## ✅ JÁ FEITO (Código limpo)

- [x] Removida chave de `script.js`
- [x] Removida chave de `admin.js`
- [x] Removida chave de `checkout.js`
- [x] Criado `.gitignore` com proteções
- [x] Criado `firebase.js` com carregamento seguro
- [x] Criado `config.local.example.js` como template
- [x] Criado `config.local.js` local
- [x] Documentação `SEGURANCA.md` criada

---

## 🔴 AÇÕES URGENTES - EXECUTE AGORA!

### 1️⃣ REVOGAR CHAVE EXPOSTA (5 minutos)

```
⏱️  Prazo: HOJE - Imediatamente!

Link: https://console.firebase.google.com
Passo:
  1. Vá para seu projeto Firebase
  2. Configurações → Chaves de API
  3. Encontre: AIzaSyDP3XJYquHpbKHNt1gvQOZS1--b0CXfknw
  4. Clique em "Delete" (Lixo)
  5. Confirme a exclusão
```

✅ Feito? Marque aqui: [x]

---

### 2️⃣ GERAR NOVA CHAVE (5 minutos)

```
⏱️  Prazo: Imediatamente após revogar

Passo:
  1. No Firebase Console → Credenciais
  2. Clique em "Criar credencial" → Chave de API
  3. Copie a chave gerada
  4. Cole em config.local.js (substituir SUA_CHAVE_DE_API_AQUI)
```

✅ Feito? Marque aqui: [x] 

---

### 3️⃣ CONFIGURAR RESTRIÇÕES (10 minutos)

```
⏱️  Prazo: Dentro de 1 hora

Passo:
  1. Firebase Console → Credenciais
  2. Selecione a NOVA chave de API
  3. Em "Restrições de Aplicação":
     ✅ Selecione: Aplicações web HTTP (origin)
     ✅ Adicione domínios:
        - localhost:3000
        - localhost:5000
        - zuca-personalizados.com
        - *.zuca-personalizados.com
  4. Em "Restrições de API":
     ✅ Selecione APENAS:
        - Firestore API
        - Firebase Services API
```

✅ Feito? Marque aqui: [x]

---

### 4️⃣ ATUALIZAR config.local.js (5 minutos)

```bash
# Abra o arquivo
nano frontend-zuca/js/config.local.js

# Procure por:
apiKey: "SUA_CHAVE_DE_API_AQUI",

# Substitua por sua NOVA chave:
apiKey: "SUA_CHAVE_NOVA_AQUI",

# Salve e feche (Ctrl+X, depois Y, depois Enter)
```

✅ Feito? Marque aqui: [x]

---

### 5️⃣ TESTAR SE FUNCIONA (5 minutos)

```bash
# Abra no navegador:
http://localhost:3000

# Abra o Console (F12) e veja:
✅ "✅ Firebase configurado com segurança"

# ❌ SE VER ERRO, volte aos passos anteriores
```

✅ Funcionando? Marque aqui: [ ]

---

### 6️⃣ VERIFICAR GIT (5 minutos)

```bash
# Confirme que chave foi removida:
grep -r "AIzaSyDP3XJYquHpbKHNt1gvQOZS1--b0CXfknw" js/

# ESPERADO: nenhum resultado!
# SE HOUVER RESULTADO: reexecute os passos 1-5
```

✅ Verificado? Marque aqui: [x]

---

## ⏰ CRONOGRAMA

| Ação | Prazo | Status |
|------|-------|--------|
| Revogar chave | Hoje | [ ] |
| Criar nova chave | Hoje | [ ] |
| Configurar restrições | Hoje | [ ] |
| Atualizar config.local.js | Hoje | [ ] |
| Testar funcionamento | Hoje | [ ] |
| Comunicar ao time | Hoje | [ ] |

---

## 📞 NOTIFICAÇÃO PARA O TIME

**Enviar para todos os desenvolvedores:**

```
Assunto: 🔴 SEGURANÇA - Chave de API Comprometida

Pessoal,

Uma chave de API do Google foi descoberta vazada no repositório público.

AÇÕES NECESSÁRIAS:
1. Atualizar seu config.local.js com a NOVA chave (veja SEGURANCA.md)
2. Fazer git pull para pegar as mudanças
3. Testar se o projeto continua funcionando

A chave antiga foi REVOGADA e NÃO funciona mais.

Link: SEGURANCA.md
Prazo: Hoje

Obrigado!
```

---

## 🔍 VERIFICAÇÃO FINAL

```bash
# CHECKLIST FINAL
git status
# Deverá mostrar: .gitignore modificado, mas config.local.js NUNCA aparece

grep -r "AIzaSyDP" .
# ESPERADO: grep avisar que arquivo está no .gitignore

# Comite as mudanças de código (sem config.local.js):
git add .gitignore firebase.js script.js admin.js checkout.js SEGURANCA.md
git commit -m "🔒 fix: Remove chaves expostas e implementa segurança"
git push origin main
```

---

## 📚 REFERÊNCIAS

- [Firebase Security Rules](https://firebase.google.com/docs/firestore/security)
- [Google Cloud API Key Protection](https://cloud.google.com/docs/authentication/api-keys)
- [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)

---

**Última atualização:** 14 de abril de 2026  
**Crítico até:** [Data que você corrigir]  
**Assinado por:** Sistema de Segurança
