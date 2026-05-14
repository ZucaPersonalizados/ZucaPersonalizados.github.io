/**
 * receituario-modelos.js
 * Configuração dos modelos de receituário disponíveis para o gerador.
 *
 * Como adicionar um novo modelo:
 * 1. Adicione um objeto no array abaixo com id, nome, logoZone e campos.
 * 2. O fundo é sempre branco — use elementos SVG (tipo: "icone") para ornamentos.
 *
 * Coordenadas referem-se ao espaço lógico 420×594px (canvas físico 1414×2000).
 * Para converter de imagem 1414×2000px: cx = px_orig × 420/1414,  cy = py_orig × 594/2000
 *
 * logoZone — retângulo onde a logo do cliente será posicionada { x, y, w, h }
 * campos   — posição de cada campo de texto { x, y, fontSize, color, align, maxWidth, fontWeight }
 */

const RECEITUARIO_MODELOS = [
  {
    id: "dourado",
    nome: "Dourado Premium",

    /*
     * Logo do cliente posicionada sobre o diâmante dourado.
     * Diâmante ocupa canvas ~x:100-172, y:15-83.
     * Usamos uma zona um pouco maior para que logos de qualquer proporção encaixem bem.
     */
    logoZone: { x: 86, y: 14, w: 100, h: 95 },

    campos: {
      /* Nome e especialidade — abaixo da zona da logo */
      nome:          { x: 210, y: 120, fontSize: 11, color: "#c8a020", align: "center", maxWidth: 290, fontWeight: "700", fontFamily: "Playfair Display" },
      especialidade: { x: 210, y: 135, fontSize:  9, color: "#b09020", align: "center", maxWidth: 290, fontWeight: "400", fontFamily: "Montserrat" },

      /*
       * Linha de contato — após os ícones WhatsApp (canvas ~x:93-113) e Instagram (canvas ~x:210-229)
       * Centro das zonas de texto:
       *   Telefone: canvas x:156, y:504  (centro entre fim do ícone WhatsApp e início do Instagram)
       *   E-mail:   canvas x:280, y:504  (após ícone Instagram)
       */
      telefone: { x: 156, y: 504, fontSize: 9, color: "#c8a020", align: "center", maxWidth: 115, fontWeight: "400", fontFamily: "Montserrat" },
      email:    { x: 280, y: 504, fontSize: 9, color: "#c8a020", align: "center", maxWidth: 135, fontWeight: "400", fontFamily: "Montserrat" },

      /*
       * Endereço — após ícone Pin (canvas ~x:103-118)
       * Centro da zona: canvas x:225, y:548
       */
      endereco:  { x: 225, y: 548, fontSize: 9, color: "#c8a020", align: "center", maxWidth: 255, fontWeight: "400", fontFamily: "Montserrat" },

      /*
       * Instagram — linha abaixo do endereço, próximo ao rodapé
       * Centro estimado: canvas x:210, y:573
       */
      instagram: { x: 210, y: 573, fontSize: 9, color: "#c8a020", align: "center", maxWidth: 255, fontWeight: "400", fontFamily: "Montserrat" },
    },

    elementos: [
      { tipo: "icone", icone: "folhagem-esquerda", x: 38,  y: 72,  tamanho: 78, cor: "#8b7c3c", editavelPeloCliente: true, labelCliente: "Cor da folhagem esquerda" },
      { tipo: "icone", icone: "folhagem-direita",  x: 384, y: 521, tamanho: 78, cor: "#8b7c3c", editavelPeloCliente: true, labelCliente: "Cor da folhagem direita" },
      { tipo: "faixa", x: 0, y: 478, largura: 420, altura: 28, cor: "#c8a020", editavelPeloCliente: true, labelCliente: "Cor do destaque" },
      { tipo: "icone", icone: "telefone", x: 50,  y: 492, tamanho: 14, cor: "#ffffff" },
      { tipo: "icone", icone: "email",    x: 175, y: 492, tamanho: 14, cor: "#ffffff" },
      { tipo: "icone", icone: "localizacao", x: 300, y: 492, tamanho: 14, cor: "#ffffff" },
      { tipo: "linha", x: 20, y: 540, comprimento: 380, espessura: 0.5, cor: "#c8a020", editavelPeloCliente: true, labelCliente: "Cor da linha" },
    ],
  },
];

export default RECEITUARIO_MODELOS;
