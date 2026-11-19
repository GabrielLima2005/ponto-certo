// Cliente da API Olho Vivo usado apenas no servidor.
// O token nunca chega ao navegador: o login acontece aqui e o cookie de
// sessão da SPTrans é reaproveitado entre as chamadas.

const BASE_URL = 'https://api.olhovivo.sptrans.com.br/v2.1';

// Só estes endpoints podem ser acessados pelo front-end.
const ENDPOINTS_PERMITIDOS = new Set([
  'Linha/Buscar',
  'Parada/Buscar',
  'Parada/BuscarParadasPorLinha',
  'Posicao/Linha',
  'Previsao/Parada',
  'Previsao',
  'Corredor',
]);

const VALIDADE_SESSAO_MS = 25 * 60 * 1000;

export class ErroApi extends Error {
  constructor(mensagem, status = 502) {
    super(mensagem);
    this.name = 'ErroApi';
    this.status = status;
  }
}

let sessao = null;
let loginEmAndamento = null;

async function autenticar() {
  const token = process.env.OLHO_VIVO_TOKEN?.trim();
  if (!token) {
    throw new ErroApi(
      'Token da SPTrans não configurado no servidor. Defina a variável OLHO_VIVO_TOKEN.',
      500,
    );
  }

  const resposta = await fetch(
    `${BASE_URL}/Login/Autenticar?token=${encodeURIComponent(token)}`,
    { method: 'POST' },
  );

  if (!resposta.ok) {
    throw new ErroApi(`O login na API Olho Vivo falhou (HTTP ${resposta.status}).`);
  }

  if ((await resposta.json()) !== true) {
    throw new ErroApi('Token da SPTrans inválido ou expirado.');
  }

  const cookies = resposta.headers.getSetCookie();
  const cookie = cookies
    .map((item) => item.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');

  if (!cookie) {
    throw new ErroApi('Login aceito, mas a SPTrans não devolveu o cookie de sessão.');
  }

  sessao = { cookie, criadaEm: Date.now() };
}

async function garantirSessao() {
  if (sessao && Date.now() - sessao.criadaEm < VALIDADE_SESSAO_MS) return;

  if (!loginEmAndamento) {
    loginEmAndamento = autenticar().finally(() => {
      loginEmAndamento = null;
    });
  }
  await loginEmAndamento;
}

async function requisitar(caminho, parametros) {
  const url = new URL(`${BASE_URL}/${caminho}`);
  for (const [chave, valor] of Object.entries(parametros)) {
    if (valor !== undefined && valor !== null && valor !== '') {
      url.searchParams.set(chave, String(valor));
    }
  }

  return fetch(url, {
    headers: { Cookie: sessao.cookie },
    cache: 'no-store',
  });
}

export async function consultarOlhoVivo(caminho, parametros = {}) {
  if (!ENDPOINTS_PERMITIDOS.has(caminho)) {
    throw new ErroApi(`Endpoint não permitido: ${caminho}`, 400);
  }

  for (let tentativa = 0; tentativa < 2; tentativa += 1) {
    await garantirSessao();
    const resposta = await requisitar(caminho, parametros);

    if (resposta.status === 401 || resposta.status === 403) {
      sessao = null;
      continue;
    }

    if (!resposta.ok) {
      throw new ErroApi(`A API Olho Vivo respondeu com erro HTTP ${resposta.status}.`);
    }

    const texto = await resposta.text();
    try {
      return JSON.parse(texto);
    } catch {
      return texto;
    }
  }

  throw new ErroApi('Não foi possível autenticar na API Olho Vivo. Tente novamente.');
}
