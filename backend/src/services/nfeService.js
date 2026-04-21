/**
 * nfeService.js
 * Integração com a API Focus NFe para emissão de NF-e (modelo 55) junto à SEFAZ-MS.
 * Regime: Simples Nacional | NCM padrão: 48201010 (papelaria)
 */

const FOCUSNFE_HOSTS = {
  homologacao: "https://homologacao.focusnfe.com.br",
  producao: "https://api.focusnfe.com.br",
};

function getConfig() {
  const ambiente = String(process.env.FOCUSNFE_AMBIENTE || "homologacao").trim().toLowerCase();
  const token =
    ambiente === "producao"
      ? String(process.env.FOCUSNFE_TOKEN_PROD || "").trim()
      : String(process.env.FOCUSNFE_TOKEN_SANDBOX || "").trim();

  if (!token) throw new Error("Token Focus NFe não configurado (FOCUSNFE_TOKEN_SANDBOX / FOCUSNFE_TOKEN_PROD)");

  const host = FOCUSNFE_HOSTS[ambiente] || FOCUSNFE_HOSTS.homologacao;
  // Focus NFe usa Basic Auth: token como usuário, senha vazia
  const authHeader = "Basic " + Buffer.from(token + ":").toString("base64");

  return { host, authHeader, ambiente };
}

function digitsOnly(v) {
  return String(v || "").replace(/\D/g, "");
}

function padCep(v) {
  return digitsOnly(v).padStart(8, "0").slice(0, 8);
}

/**
 * Determina CFOP e local_destino com base no estado do destinatário.
 * Dentro do MS: 5102 / destino 1
 * Outro estado: 6102 / destino 2
 */
function getCfopEDestino(estadoCliente) {
  const uf = String(estadoCliente || "").toUpperCase().trim();
  if (uf === "MS") return { cfop: "5102", local_destino: 1 };
  return { cfop: "6102", local_destino: 2 };
}

/**
 * Monta o payload JSON que o Focus NFe espera para emissão de NF-e.
 * @param {object} pedido - documento do Firestore
 * @param {object} produtosMap - mapa { produtoId: { ncm, ... } }
 */
export function buildNfePayload(pedido, produtosMap = {}) {
  const cliente = pedido.cliente || {};
  const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
  const frete = pedido.frete || {};

  const cpfCnpj = digitsOnly(cliente.cpfCnpj || cliente.cpf || "");
  if (!cpfCnpj) throw new Error("CPF/CNPJ do cliente não preenchido no pedido");

  const { cfop, local_destino } = getCfopEDestino(cliente.estado);

  const emitente = {
    cnpj: digitsOnly(process.env.EMPRESA_CNPJ || ""),
    nome: String(process.env.EMPRESA_NOME || "").trim(),
    nome_fantasia: String(process.env.EMPRESA_NOME_FANTASIA || "").trim(),
    inscricao_estadual: digitsOnly(process.env.EMPRESA_IE || ""),
    regime_tributario: "1", // 1 = Simples Nacional
    logradouro: String(process.env.EMPRESA_LOGRADOURO || "").trim(),
    numero: String(process.env.EMPRESA_NUMERO || "S/N").trim(),
    bairro: String(process.env.EMPRESA_BAIRRO || "").trim(),
    municipio: String(process.env.EMPRESA_MUNICIPIO || "Campo Grande").trim(),
    uf: String(process.env.EMPRESA_UF || "MS").trim(),
    cep: padCep(process.env.EMPRESA_CEP || "79010190"),
    codigo_municipio: String(process.env.EMPRESA_CODIGO_MUNICIPIO || "5002704").trim(),
    telefone: digitsOnly(process.env.EMPRESA_TELEFONE || ""),
  };

  // Destinatário
  const destinatario = {
    nome: String(cliente.nome || "Cliente").trim().slice(0, 60),
    email: String(cliente.email || "").trim().toLowerCase().slice(0, 60),
    endereco: String(cliente.endereco || "").trim().slice(0, 60),
    numero: String(cliente.numero || "S/N").trim().slice(0, 60),
    bairro: String(cliente.bairro || "").trim().slice(0, 60),
    municipio: String(cliente.cidade || "").trim().slice(0, 60),
    uf: String(cliente.estado || "MS").trim().toUpperCase().slice(0, 2),
    cep: padCep(cliente.cep || ""),
    telefone: digitsOnly(cliente.telefone || ""),
  };

  if (cpfCnpj.length === 11) {
    destinatario.cpf = cpfCnpj;
    destinatario.indicador_ie_destinatario = "9"; // Não contribuinte
  } else if (cpfCnpj.length === 14) {
    destinatario.cnpj = cpfCnpj;
    destinatario.indicador_ie_destinatario = "9";
  }

  // Itens da NF-e
  const items = itens.map((item, idx) => {
    const produtoData = produtosMap[item.id] || {};
    const ncm = String(produtoData.ncm || item.ncm || "48201010").replace(/\D/g, "").slice(0, 8);
    const preco = Number(item.preco || 0);
    const qtd = Number(item.quantidade || 1);
    const valorTotal = Number((preco * qtd).toFixed(2));

    return {
      numero_item: String(idx + 1),
      codigo_produto: String(item.id || `ITEM${idx + 1}`).slice(0, 60),
      descricao: String(item.nome || "Produto").trim().slice(0, 120),
      ncm,
      cfop,
      unidade_comercial: "UN",
      quantidade_comercial: qtd,
      valor_unitario_comercial: preco,
      valor_bruto: valorTotal,
      unidade_tributavel: "UN",
      quantidade_tributavel: qtd,
      valor_unitario_tributavel: preco,
      // ICMS: Simples Nacional — CSOSN 400 (tributada pelo SN sem permissão de crédito)
      icms_origem: "0",
      icms_csosn: "400",
      // PIS: CST 07 (operação isenta de contribuição)
      pis_situacao_tributaria: "07",
      pis_aliquota_porcentual: "0.00",
      pis_base_calculo: "0.00",
      pis_valor: "0.00",
      // COFINS: CST 70 (alíquota zero)
      cofins_situacao_tributaria: "07",
      cofins_aliquota_porcentual: "0.00",
      cofins_base_calculo: "0.00",
      cofins_valor: "0.00",
      // Código de benefício fiscal MS (Simples)
      codigo_beneficio_fiscal: "MS819999",
      inclui_no_total: "1",
    };
  });

  if (items.length === 0) throw new Error("Pedido sem itens");

  // Totais
  const subtotal = Number((pedido.subtotal || itens.reduce((s, i) => s + Number(i.preco || 0) * Number(i.quantidade || 1), 0)).toFixed(2));
  const valorFrete = Number((frete.valor || 0).toFixed(2));
  const desconto = Number((pedido.desconto || 0).toFixed(2));
  const totalNota = Number((subtotal - desconto + valorFrete).toFixed(2));

  const payload = {
    natureza_operacao: "Venda de Mercadoria",
    data_emissao: new Date().toISOString().slice(0, 19) + "-04:00",
    data_entrada_saida: new Date().toISOString().slice(0, 19) + "-04:00",
    tipo_documento: "1", // 1 = saída
    local_destino,
    finalidade_emissao: "1", // 1 = NF-e normal
    consumidor_final: "1",
    presenca_comprador: "2", // 2 = operação não presencial (internet)
    modalidade_frete: "1", // 1 = Por conta do destinatário (FOB)
    emitente,
    destinatario,
    items,
    // Frete
    transporte_modalidade_frete: "1",
  };

  // Adiciona frete e desconto ao payload se existirem
  if (valorFrete > 0) {
    payload.valor_frete = valorFrete;
    payload.valor_total = totalNota;
  }
  if (desconto > 0) {
    payload.valor_desconto = desconto;
  }

  return payload;
}

/**
 * Envia a NF-e para o Focus NFe.
 * @param {string} ref - referência única (ex: "zuca-abc123")
 * @param {object} payload - resultado de buildNfePayload
 */
export async function emitirNfe(ref, payload) {
  const { host, authHeader } = getConfig();
  const url = `${host}/v2/nfe?ref=${encodeURIComponent(ref)}`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { Authorization: authHeader, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await resp.json().catch(() => ({}));

  if (!resp.ok && resp.status !== 409) {
    // 409 = NF-e já emitida com esta ref (idempotente)
    const msg = data?.mensagem || data?.erros?.[0]?.mensagem || `HTTP ${resp.status}`;
    throw new Error(`Focus NFe emissão: ${msg}`);
  }

  return data;
}

/**
 * Consulta o status da NF-e com polling.
 * Aguarda até statusTimeoutMs para sair de "processando".
 * @returns {object} resposta Focus NFe com status, chave_nfe, numero, serie, etc.
 */
export async function consultarNfe(ref, { statusTimeoutMs = 30000, pollIntervalMs = 2000 } = {}) {
  const { host, authHeader } = getConfig();
  const url = `${host}/v2/nfe?ref=${encodeURIComponent(ref)}`;

  const deadline = Date.now() + statusTimeoutMs;

  while (true) {
    const resp = await fetch(url, {
      headers: { Authorization: authHeader },
    });

    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      const msg = data?.mensagem || `HTTP ${resp.status}`;
      throw new Error(`Focus NFe consulta: ${msg}`);
    }

    const data = await resp.json();
    const status = String(data?.status || "").toLowerCase();

    if (status !== "processando") return data;
    if (Date.now() >= deadline) return data; // devolve mesmo em processando após timeout

    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
}

/**
 * Baixa o PDF do DANFE e retorna como Buffer.
 */
export async function getDanfePdfBuffer(ref) {
  const { host, authHeader } = getConfig();
  const url = `${host}/v2/nfe/${encodeURIComponent(ref)}/danfe`;

  const resp = await fetch(url, { headers: { Authorization: authHeader } });
  if (!resp.ok) throw new Error(`Erro ao baixar DANFE: HTTP ${resp.status}`);

  const arrayBuffer = await resp.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
