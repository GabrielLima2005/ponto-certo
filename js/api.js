// Conversa com a função serverless do projeto, que repassa as consultas
// autenticadas para a API Olho Vivo da SPTrans.

const ROTA_PROXY = '/api/olhovivo';

const MENSAGEM_SEM_SERVIDOR =
  'Sem conexão com o servidor. No computador, rode "npm run dev" e acesse http://localhost:3000.';

async function consultar(caminho, parametros = {}) {
  if (window.location.protocol === 'file:') {
    throw new Error(
      'Abra o app pelo servidor local ou pela URL publicada. Rode "npm run dev" e acesse http://localhost:3000.',
    );
  }

  const url = new URL(ROTA_PROXY, window.location.origin);
  url.searchParams.set('path', caminho);

  for (const [chave, valor] of Object.entries(parametros)) {
    if (valor !== undefined && valor !== null && valor !== '') {
      url.searchParams.set(chave, String(valor));
    }
  }

  let resposta;
  try {
    resposta = await fetch(url);
  } catch {
    throw new Error(MENSAGEM_SEM_SERVIDOR);
  }

  const dados = await resposta.json().catch(() => null);

  if (!resposta.ok || dados === null) {
    const mensagem =
      dados?.erro ||
      (resposta.ok ? MENSAGEM_SEM_SERVIDOR : `Falha na consulta (HTTP ${resposta.status}).`);
    const erro = new Error(mensagem);
    erro.status = resposta.status;
    throw erro;
  }

  return dados;
}

export const api = {
  buscarParadas: (termo) => consultar('Parada/Buscar', { termosBusca: termo }),
  previsaoParada: (codigoParada) => consultar('Previsao/Parada', { codigoParada }),
  posicaoLinha: (codigoLinha) => consultar('Posicao/Linha', { codigoLinha }),
  buscarLinhas: (termo) => consultar('Linha/Buscar', { termosBusca: termo }),
};
