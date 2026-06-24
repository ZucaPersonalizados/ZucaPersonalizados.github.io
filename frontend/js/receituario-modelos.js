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
    nome: "Receituário Clássico",

    /*
     * Fundo decorativo via SVG: folhagens teal nos cantos e rodapé teal.
     * SVG viewBox 595.5×842.25 → canvas lógico 420×594 (escala ≈0.705).
     *
     * Zonas a evitar (canvas coords):
     *   Folhagem superior-direita: x > 308, y < 197
     *   Folhagem inferior-esquerda: x < 140, y > 344
     *   Rodapé SVG: y ≈ 551–594
     *     Ícone localização: center x≈34, y≈565
     *     Ícone whatsapp:    center x≈288, y≈566
     */
    svgTemplate: "img/modelos/receituario-modelo.svg",

    logoZone: { x: 86, y: 14, w: 100, h: 95 },

    campos: {
      /* Nome e especialidade — abaixo da zona da logo, área segura esquerda */
      nome:          { x: 210, y: 120, fontSize: 11, color: "#395b64", align: "center", maxWidth: 250, fontWeight: "700", fontFamily: "Playfair Display" },
      especialidade: { x: 210, y: 136, fontSize:  9, color: "#5e8a90", align: "center", maxWidth: 250, fontWeight: "400", fontFamily: "Montserrat" },

      /*
       * Rodapé SVG (canvas y ≈ 551–594, center y ≈ 572).
       * O SVG já desenha os ícones; o canvas posiciona apenas o texto.
       *   Linha 1 (y=566): endereço (entre pino e whatsapp) + telefone (após whatsapp)
       *   Linha 2 (y=580): e-mail (esquerda) + instagram (direita)
       */
      endereco:  { x: 159, y: 566, fontSize: 8.5, color: "#ffffff", align: "center", maxWidth: 235, fontWeight: "400", fontFamily: "Montserrat" },
      telefone:  { x: 357, y: 566, fontSize: 8.5, color: "#ffffff", align: "center", maxWidth: 115, fontWeight: "400", fontFamily: "Montserrat" },
      email:     { x: 159, y: 580, fontSize: 8,   color: "#ffffff", align: "center", maxWidth: 235, fontWeight: "400", fontFamily: "Montserrat" },
      instagram: { x: 357, y: 580, fontSize: 8,   color: "#ffffff", align: "center", maxWidth: 115, fontWeight: "400", fontFamily: "Montserrat" },
    },

    /* O SVG já contém folhagens, rodapé e ícones decorativos */
    elementos: [],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // MODELO COM SVG + GRADIENTE EDITÁVEL
  //
  // O fundo decorativo vem de um arquivo SVG externo (svgTemplate).
  // O cliente pode alterar as cores via pickers — gradientes incluídos.
  //
  // Como usar com o Canva:
  //   1. Exporte o template como SVG (Canva Pro: Compartilhar → Download → SVG)
  //   2. Abra o .svg no VS Code e anote os valores HEX das cores que quer tornar
  //      editáveis (Ctrl+F para buscar "#").
  //   3. Salve o arquivo em frontend/img/modelos/nome-do-modelo.svg
  //   4. Substitua o svgTemplate abaixo pelo caminho correto e atualize
  //      coresEditaveis com os hexes reais do seu SVG.
  //
  // coresEditaveis:
  //   • Entradas SEM derivaDe  → aparecem no UI (color picker para o cliente)
  //   • Entradas COM derivaDe  → calculadas automaticamente via ajuste de
  //     luminosidade HSL quando a cor-pai muda (perfeito para paradas de gradiente)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "dourado-gradiente",
    nome: "Dourado com Gradiente",
    svgTemplate: "img/modelos/dourado-gradiente.svg",
    thumbnail:   "img/modelos/dourado-gradiente.svg",

    coresEditaveis: [
      // ── Cor principal: o cliente escolhe esta ──────────────────────────
      { id: "principal",        label: "Cor principal",   hexOriginal: "#c8a020", valor: "#c8a020" },

      // ── Derivadas (hidden): calculadas automaticamente ─────────────────
      // Parada clara do gradiente (+15% luminosidade)
      { id: "principal-claro",  derivaDe: "principal", ajuste: { luminosidade: +0.15 }, hexOriginal: "#e8c040", valor: "#e8c040" },
      // Parada escura do gradiente (-15% luminosidade)
      { id: "principal-escuro", derivaDe: "principal", ajuste: { luminosidade: -0.15 }, hexOriginal: "#8b6010", valor: "#8b6010" },

      // ── Segunda cor editável ───────────────────────────────────────────
      { id: "folhagem",         label: "Cor das folhagens", hexOriginal: "#8b7c3c", valor: "#8b7c3c" },
    ],

    logoZone: { x: 160, y: 15, w: 100, h: 80 },

    campos: {
      /* Nome e especialidade — abaixo da faixa de cabeçalho (y: 0–105) */
      nome:          { x: 210, y: 127, fontSize: 11, color: "#c8a020", align: "center", maxWidth: 290, fontWeight: "700",  fontFamily: "Playfair Display", derivaCorDe: "principal" },
      especialidade: { x: 210, y: 142, fontSize:  9, color: "#a08018", align: "center", maxWidth: 290, fontWeight: "400",  fontFamily: "Montserrat" },

      /* Contato — dentro da faixa de rodapé (y: 478–506), texto branco */
      telefone: { x: 110, y: 492, fontSize: 9, color: "#ffffff", align: "center", maxWidth: 110, fontWeight: "400", fontFamily: "Montserrat" },
      email:    { x: 265, y: 492, fontSize: 9, color: "#ffffff", align: "center", maxWidth: 130, fontWeight: "400", fontFamily: "Montserrat" },

      /* Endereço e Instagram — abaixo da faixa */
      endereco:  { x: 210, y: 553, fontSize: 9, color: "#c8a020", align: "center", maxWidth: 260, fontWeight: "400", fontFamily: "Montserrat", derivaCorDe: "principal" },
      instagram: { x: 210, y: 576, fontSize: 9, color: "#c8a020", align: "center", maxWidth: 260, fontWeight: "400", fontFamily: "Montserrat", derivaCorDe: "principal" },
    },

    /* Apenas ícones de contato dentro da faixa — o SVG já cuida do resto */
    elementos: [
      { tipo: "icone", icone: "telefone",    x: 50,  y: 492, tamanho: 14, cor: "#ffffff" },
      { tipo: "icone", icone: "email",       x: 178, y: 492, tamanho: 14, cor: "#ffffff" },
      { tipo: "icone", icone: "localizacao", x: 305, y: 492, tamanho: 14, cor: "#ffffff" },
    ],
  },
];

export default RECEITUARIO_MODELOS;
