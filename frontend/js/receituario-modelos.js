/**
 * receituario-modelos.js
 * Fallback estático de modelos de receituário.
 * Em produção, os modelos reais vêm da API (Firestore) via produto.js.
 * Este arquivo é usado apenas quando a API não retorna nenhum modelo.
 *
 * Para criar/editar modelos: use o Painel Admin → Produtos → Modelo de receituário.
 * Cole o SVG no campo "SVG do modelo", posicione os marcadores no canvas e salve.
 */

const RECEITUARIO_MODELOS = [
  {
    // ID deve coincidir com o ID do produto cadastrado no admin.
    // Se o produto existir no banco, estes dados são substituídos pelos do banco.
    id: "receituario-classico",
    nome: "Receituário Clássico",

    svgTemplate: "img/modelos/receituario-modelo.svg",

    logoZone: { x: 86, y: 14, w: 100, h: 95 },

    campos: {
      nome:          { x: 210, y: 120, fontSize: 11, color: "#395b64", align: "center", maxWidth: 250, fontWeight: "700", fontFamily: "Playfair Display" },
      especialidade: { x: 210, y: 136, fontSize:  9, color: "#5e8a90", align: "center", maxWidth: 250, fontWeight: "400", fontFamily: "Montserrat" },
      endereco:      { x: 159, y: 566, fontSize:  8.5, color: "#ffffff", align: "center", maxWidth: 235, fontWeight: "400", fontFamily: "Montserrat" },
      telefone:      { x: 357, y: 566, fontSize:  8.5, color: "#ffffff", align: "center", maxWidth: 115, fontWeight: "400", fontFamily: "Montserrat" },
      email:         { x: 159, y: 580, fontSize:  8,   color: "#ffffff", align: "center", maxWidth: 235, fontWeight: "400", fontFamily: "Montserrat" },
      instagram:     { x: 357, y: 580, fontSize:  8,   color: "#ffffff", align: "center", maxWidth: 115, fontWeight: "400", fontFamily: "Montserrat" },
    },

    elementos: [],
  },
];

export default RECEITUARIO_MODELOS;

