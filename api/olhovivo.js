// Função serverless da Vercel: /api/olhovivo?path=Previsao/Parada&codigoParada=...
// O front-end chama esta rota na mesma origem, então não há problema de CORS
// nem exposição do token da SPTrans.

import { consultarOlhoVivo, ErroApi } from './_lib/olhovivo.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ erro: 'Método não permitido.' });
    return;
  }

  const { path, ...parametros } = req.query;
  if (typeof path !== 'string' || !path) {
    res.status(400).json({ erro: 'Informe o endpoint em ?path=.' });
    return;
  }

  res.setHeader('Cache-Control', 'no-store');

  try {
    const dados = await consultarOlhoVivo(path, parametros);
    res.status(200).json(dados);
  } catch (erro) {
    const status = erro instanceof ErroApi ? erro.status : 502;
    res.status(status).json({ erro: erro.message });
  }
}
