// Servidor de desenvolvimento: entrega os arquivos estáticos e responde
// /api/olhovivo com a mesma lógica da função serverless da Vercel.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { consultarOlhoVivo, ErroApi } from './api/_lib/olhovivo.js';

const PORTA = Number(process.env.PORT ?? 3000);
const RAIZ = resolve('.');

const TIPOS = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.ico', 'image/x-icon'],
]);

function responderJson(res, status, corpo) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(corpo));
}

async function tratarApi(url, res) {
  const caminho = url.searchParams.get('path');
  if (!caminho) {
    responderJson(res, 400, { erro: 'Informe o endpoint em ?path=.' });
    return;
  }

  const parametros = {};
  for (const [chave, valor] of url.searchParams) {
    if (chave !== 'path') parametros[chave] = valor;
  }

  try {
    responderJson(res, 200, await consultarOlhoVivo(caminho, parametros));
  } catch (erro) {
    const status = erro instanceof ErroApi ? erro.status : 502;
    responderJson(res, status, { erro: erro.message });
  }
}

async function tratarEstatico(url, res) {
  let caminhoRelativo = url.pathname === '/' ? 'index.html' : url.pathname;
  try {
    caminhoRelativo = decodeURIComponent(caminhoRelativo);
  } catch {
    caminhoRelativo = '';
  }

  const arquivo = resolve(join(RAIZ, caminhoRelativo.replace(/^\/+/, '')));
  const dentroDoProjeto = arquivo.startsWith(RAIZ + sep);

  if (!dentroDoProjeto || !TIPOS.has(extname(arquivo))) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Arquivo não encontrado.');
    return;
  }

  try {
    const conteudo = await readFile(arquivo);
    res.writeHead(200, {
      'Content-Type': TIPOS.get(extname(arquivo)),
      'Cache-Control': 'no-cache',
    });
    res.end(conteudo);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Arquivo não encontrado.');
  }
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

    if (url.pathname === '/api/olhovivo') {
      await tratarApi(url, res);
      return;
    }

    await tratarEstatico(url, res);
  } catch (erro) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`Erro interno: ${erro.message}`);
  }
}).listen(PORTA, () => {
  console.log(`Ponto Certo rodando em http://localhost:${PORTA}`);
  if (!process.env.OLHO_VIVO_TOKEN) {
    console.warn('Aviso: crie o arquivo .env com OLHO_VIVO_TOKEN para consultar a SPTrans.');
  }
});
