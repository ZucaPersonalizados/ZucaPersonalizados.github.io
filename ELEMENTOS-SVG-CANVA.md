# Como adicionar elementos decorativos SVG do Canva

## 1. Exportar o SVG do Canva

No Canva, selecione apenas o elemento decorativo (folhagem, ornamento, etc.) e exporte como **SVG**.

---

## 2. Abrir o SVG e coletar os dados

Abra o arquivo `.svg` em qualquer editor de texto (VS Code, bloco de notas, etc.).

### Encontre o viewBox:
```xml
<svg viewBox="0 0 200 280" ...>
```
Anote os valores: `vw = 200`, `vh = 280`.

### Copie os paths:
Procure todas as tags `<path>` e copie o valor do atributo `d="..."` de cada uma:
```xml
<path d="M10 20 L30 40 Z"/>
<path d="M50 60 C70 80 90 100 110 120Z"/>
```

---

## 3. Adicionar em `icones-paths.js`

Abra `frontend/js/icones-paths.js` e adicione na seção de **Elementos decorativos**:

```js
// Formato para ícones simples (viewBox 24×24):
whatsapp: "M17.472 14.382...",

// Formato para elementos do Canva (viewBox customizado):
folhagem_canto: {
  paths: [
    "M10 20 L30 40 Z",       // path 1
    "M50 60 C70 80 90 100 110 120Z",  // path 2
  ],
  vw: 200,   // largura do viewBox original
  vh: 280,   // altura do viewBox original
},
```

> **Dica:** Se o SVG tiver apenas um `<path>`, o array `paths` terá apenas um item.

---

## 4. Usar no JSON do modelo

Em `receituario-modelos.js`, adicione o elemento no array `elementos` do modelo:

```js
{
  tipo:   "icone",
  icone:  "folhagem_canto",   // chave definida em icones-paths.js
  x:      300,                // posição horizontal (espaço lógico 420px)
  y:      0,                  // posição vertical (espaço lógico 594px)
  tamanho: 100,               // largura final em px lógicos (altura é proporcional ao viewBox)
  cor:    "#c8a020",          // cor inicial
  editavelPeloCliente: true,  // aparece no painel de personalização?
  labelCliente: "Cor da folhagem",  // texto do picker no painel
}
```

---

## 5. Referência rápida de coordenadas

O canvas usa espaço **lógico 420 × 594 px** (canvas físico 1414 × 2000 px).

Para converter coordenadas de uma imagem 1414×2000 para o espaço lógico:
```
x_logico = x_pixel × (420 / 1414)
y_logico = y_pixel × (594 / 2000)
```

---

## 6. Campos opcionais do elemento

| Campo               | Padrão  | Descrição                                      |
|---------------------|---------|------------------------------------------------|
| `cor`               | `#333`  | Cor de preenchimento (fill) do SVG             |
| `tamanho`           | `12`    | Largura em px lógicos; altura é proporcional   |
| `editavelPeloCliente` | `false` | Exibe o color picker no painel do cliente    |
| `labelCliente`      | —       | Rótulo exibido no color picker                 |
| `opacidade`         | `1`     | Transparência (0–1)                            |

---

## Arquivo de referência

Todos os paths ficam em: `frontend/js/icones-paths.js`

Os elementos são renderizados por `desenharIconeCanvas()` em `produto.js` e pelo preview em `admin.js` — ambos já suportam viewBox customizado e múltiplos paths.
