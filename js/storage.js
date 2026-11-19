// Preferências e pontos favoritos ficam no localStorage do navegador.

const CHAVE_FAVORITOS = 'ponto-certo:favoritos';
const CHAVE_ULTIMA_PARADA = 'ponto-certo:ultima-parada';
const CHAVE_AUTO_ATUALIZAR = 'ponto-certo:auto-atualizar';

function lerJson(chave, padrao) {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto ? JSON.parse(bruto) : padrao;
  } catch {
    return padrao;
  }
}

function gravarJson(chave, valor) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // Modo privado ou cota cheia: o app segue funcionando sem persistir.
  }
}

export function listarFavoritos() {
  const lista = lerJson(CHAVE_FAVORITOS, []);
  return Array.isArray(lista) ? lista : [];
}

export function ehFavorito(codigoParada) {
  return listarFavoritos().some((parada) => parada.cp === codigoParada);
}

export function alternarFavorito(parada) {
  const favoritos = listarFavoritos();
  const existe = favoritos.some((item) => item.cp === parada.cp);
  const atualizados = existe
    ? favoritos.filter((item) => item.cp !== parada.cp)
    : [...favoritos, { cp: parada.cp, np: parada.np, ed: parada.ed }];

  gravarJson(CHAVE_FAVORITOS, atualizados);
  return !existe;
}

export function salvarUltimaParada(parada) {
  gravarJson(CHAVE_ULTIMA_PARADA, { cp: parada.cp, np: parada.np, ed: parada.ed });
}

export function lerUltimaParada() {
  const parada = lerJson(CHAVE_ULTIMA_PARADA, null);
  return parada && parada.cp ? parada : null;
}

export function lerAutoAtualizar() {
  const valor = localStorage.getItem(CHAVE_AUTO_ATUALIZAR);
  return valor === null ? true : valor === 'true';
}

export function salvarAutoAtualizar(ativo) {
  try {
    localStorage.setItem(CHAVE_AUTO_ATUALIZAR, String(ativo));
  } catch {
    // Sem persistência, o checkbox continua valendo nesta sessão.
  }
}
