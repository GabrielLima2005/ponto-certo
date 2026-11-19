import { api } from './api.js';
import {
  alternarFavorito,
  ehFavorito,
  lerAutoAtualizar,
  lerUltimaParada,
  listarFavoritos,
  salvarAutoAtualizar,
  salvarUltimaParada,
} from './storage.js';

const INTERVALO_ATUALIZACAO_MS = 30_000;
const MINIMO_CARACTERES_BUSCA = 2;
const CENTRO_SAO_PAULO = [-23.5505, -46.6333];

const porId = (id) => document.getElementById(id);

const ui = {
  statusApi: porId('status-api'),
  statusTexto: porId('status-texto'),
  campoBusca: porId('campo-busca'),
  buscaStatus: porId('busca-status'),
  resultados: porId('resultados-busca'),
  botaoLocalizacao: porId('botao-localizacao'),
  favoritos: porId('lista-favoritos'),
  favoritosVazio: porId('favoritos-vazio'),
  boasVindas: porId('boas-vindas'),
  painel: porId('painel-parada'),
  paradaNome: porId('parada-nome'),
  paradaEndereco: porId('parada-endereco'),
  paradaCodigo: porId('parada-codigo'),
  atualizadoEm: porId('atualizado-em'),
  autoAtualizar: porId('auto-atualizar'),
  botaoAtualizar: porId('botao-atualizar'),
  botaoFavoritar: porId('botao-favoritar'),
  avisoErro: porId('aviso-erro'),
  chegadas: porId('lista-chegadas'),
  chegadasVazio: porId('chegadas-vazio'),
  mapa: porId('mapa'),
  mapaLegenda: porId('mapa-legenda'),
};

const estado = {
  parada: null,
  chegadas: null,
  carregando: false,
  erro: null,
  atualizadoEm: null,
  proximaAtualizacao: null,
  autoAtualizar: true,
  resultados: [],
  termoBusca: '',
  buscaCarregando: false,
  erroBusca: null,
  posicaoUsuario: null,
  mapa: null,
  marcadorParada: null,
  camadaOnibus: null,
  linhaNoMapa: null,
  onibus: [],
  onibusPlotados: 0,
  carregandoOnibus: false,
  erroMapa: null,
  hrOnibus: null,
};

let temporizadorBusca = null;
let versaoOnibus = 0;
let versaoChegadas = 0;

/* ---------- Utilidades ---------- */

function definirStatus(tipo, texto) {
  ui.statusApi.classList.remove('conectado', 'erro', 'consultando');
  if (tipo) ui.statusApi.classList.add(tipo);
  ui.statusTexto.textContent = texto;
}

function minutosParaChegar(horaPrevista, horaConsulta) {
  if (!horaPrevista || !horaConsulta) return null;

  const [h1, m1] = horaPrevista.split(':').map(Number);
  const [h2, m2] = horaConsulta.split(':').map(Number);
  if ([h1, m1, h2, m2].some(Number.isNaN)) return null;

  let diferenca = h1 * 60 + m1 - (h2 * 60 + m2);
  if (diferenca < -60) diferenca += 24 * 60;
  return diferenca;
}

function formatarMinutos(minutos) {
  if (minutos == null) return '—';
  if (minutos <= 0) return 'agora';
  if (minutos === 1) return '1 min';
  if (minutos < 60) return `${minutos} min`;

  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}

function coordenadasValidas(parada) {
  const lat = Number(parada?.py);
  const lng = Number(parada?.px);
  return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
}

function haversineMetros(lat1, lng1, lat2, lng2) {
  const raioTerra = 6_371_000;
  const emRadianos = (graus) => (graus * Math.PI) / 180;
  const dLat = emRadianos(lat2 - lat1);
  const dLng = emRadianos(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(emRadianos(lat1)) * Math.cos(emRadianos(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * raioTerra * Math.asin(Math.sqrt(a));
}

function distanciaAte(parada) {
  if (!estado.posicaoUsuario || !coordenadasValidas(parada)) return null;
  return haversineMetros(
    estado.posicaoUsuario.lat,
    estado.posicaoUsuario.lng,
    Number(parada.py),
    Number(parada.px),
  );
}

function formatarDistancia(metros) {
  if (metros < 1000) return `a ${Math.round(metros / 10) * 10} m`;
  return `a ${(metros / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`;
}

function ordenarPorDistancia(paradas) {
  if (!estado.posicaoUsuario) return [...paradas];

  return [...paradas].sort((a, b) => {
    const distanciaA = distanciaAte(a);
    const distanciaB = distanciaAte(b);
    if (distanciaA === null && distanciaB === null) return 0;
    if (distanciaA === null) return 1;
    if (distanciaB === null) return -1;
    return distanciaA - distanciaB;
  });
}

/* ---------- Mapa ---------- */

function obterMapa() {
  if (estado.mapa) return estado.mapa;

  if (typeof L === 'undefined') {
    ui.mapaLegenda.textContent = 'Mapa indisponível: não foi possível carregar o Leaflet.';
    return null;
  }

  const mapa = L.map(ui.mapa, { scrollWheelZoom: false });
  mapa.setView(CENTRO_SAO_PAULO, 12);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(mapa);

  estado.camadaOnibus = L.layerGroup().addTo(mapa);
  estado.mapa = mapa;
  return mapa;
}

function criarIcone(emoji, classe) {
  return L.divIcon({
    className: `marcador ${classe}`,
    html: `<span aria-hidden="true">${emoji}</span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
}

function construirPopupParada(parada) {
  const caixa = document.createElement('div');
  caixa.className = 'popup-onibus';

  const titulo = document.createElement('strong');
  titulo.textContent = parada.np ?? 'Ponto de ônibus';

  const endereco = document.createElement('p');
  endereco.textContent = parada.ed ?? '';

  const codigo = document.createElement('p');
  codigo.textContent = `Código ${parada.cp}`;

  caixa.append(titulo, endereco, codigo);
  return caixa;
}

function construirPopupOnibus(veiculo) {
  const caixa = document.createElement('div');
  caixa.className = 'popup-onibus';

  const titulo = document.createElement('strong');
  titulo.textContent = `Linha ${estado.linhaNoMapa?.c ?? veiculo.linha?.c ?? ''}`.trim();

  const identificacao = document.createElement('p');
  identificacao.textContent = `Veículo ${veiculo.p ?? '—'}${veiculo.a ? ' · acessível ♿' : ''}`;

  caixa.append(titulo, identificacao);

  if (estado.hrOnibus) {
    const hora = document.createElement('p');
    hora.textContent = `Posição às ${estado.hrOnibus}`;
    caixa.append(hora);
  }

  return caixa;
}

function mostrarParadaNoMapa(parada) {
  const mapa = obterMapa();
  if (!mapa || !coordenadasValidas(parada)) return;

  const posicao = [Number(parada.py), Number(parada.px)];

  if (!estado.marcadorParada) {
    estado.marcadorParada = L.marker(posicao, {
      icon: criarIcone('🚏', 'marcador-parada'),
      title: 'Ponto selecionado',
    }).addTo(mapa);
  } else {
    estado.marcadorParada.setLatLng(posicao);
  }

  estado.marcadorParada.bindPopup(construirPopupParada(parada));
  mapa.setView(posicao, 16);
}

function limparOnibus() {
  versaoOnibus += 1;
  estado.linhaNoMapa = null;
  estado.onibus = [];
  estado.onibusPlotados = 0;
  estado.carregandoOnibus = false;
  estado.erroMapa = null;
  estado.hrOnibus = null;
  estado.camadaOnibus?.clearLayers();
}

function normalizarOnibus(dados) {
  // A API responde { hr, vs } para /Posicao/Linha e, em outras versões,
  // pode agrupar os veículos em { l: [{ vs }] }.
  if (Array.isArray(dados?.vs)) {
    return {
      onibus: dados.vs.map((veiculo) => ({ ...veiculo, linha: dados })),
      hora: dados?.hr ?? null,
    };
  }

  const linhas = Array.isArray(dados?.l) ? dados.l : dados?.l ? [dados.l] : [];
  const onibus = [];

  for (const linha of linhas) {
    if (!Array.isArray(linha?.vs)) continue;
    for (const veiculo of linha.vs) onibus.push({ ...veiculo, linha });
  }

  return { onibus, hora: dados?.hr ?? null };
}

function aplicarPosicoes(dados) {
  const { onibus, hora } = normalizarOnibus(dados);
  estado.onibus = onibus;
  estado.hrOnibus = hora;
  desenharOnibus();
}

function desenharOnibus() {
  const mapa = obterMapa();
  if (!mapa || !estado.camadaOnibus) return;

  estado.camadaOnibus.clearLayers();
  const pontos = [];
  let plotados = 0;

  for (const veiculo of estado.onibus) {
    const lat = Number(veiculo.py);
    const lng = Number(veiculo.px);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) continue;

    L.marker([lat, lng], {
      icon: criarIcone('🚌', 'marcador-onibus'),
      title: `Veículo ${veiculo.p ?? ''}`.trim(),
    })
      .bindPopup(construirPopupOnibus(veiculo))
      .addTo(estado.camadaOnibus);

    pontos.push([lat, lng]);
    plotados += 1;
  }

  estado.onibusPlotados = plotados;

  if (estado.marcadorParada) pontos.push(estado.marcadorParada.getLatLng());
  if (pontos.length > 1) {
    mapa.fitBounds(L.latLngBounds(pontos).pad(0.2), { maxZoom: 16 });
  }
}

function atualizarLegendaMapa() {
  if (typeof L === 'undefined') {
    ui.mapaLegenda.textContent = 'Mapa indisponível: não foi possível carregar o Leaflet.';
    return;
  }

  if (estado.erroMapa) {
    ui.mapaLegenda.textContent = `Não foi possível carregar os ônibus: ${estado.erroMapa}`;
    return;
  }

  if (estado.linhaNoMapa) {
    if (estado.carregandoOnibus) {
      ui.mapaLegenda.textContent = `Buscando as posições da linha ${estado.linhaNoMapa.c}…`;
      return;
    }

    const total = estado.onibus.length;
    ui.mapaLegenda.textContent = total
      ? `${estado.onibusPlotados} de ${total} ônibus da linha ${estado.linhaNoMapa.c} com posição no mapa.`
      : `A linha ${estado.linhaNoMapa.c} não está reportando posições agora.`;
    return;
  }

  ui.mapaLegenda.textContent = estado.parada
    ? 'Toque em “Ver ônibus” em uma linha para acompanhar os veículos no mapa.'
    : 'Busque um ponto para vê-lo no mapa e acompanhar os ônibus.';
}

async function carregarOnibusDaLinha(linha) {
  if (!linha?.cl) return;

  const versao = ++versaoOnibus;
  estado.linhaNoMapa = linha;
  estado.onibus = [];
  estado.onibusPlotados = 0;
  estado.erroMapa = null;
  estado.carregandoOnibus = true;
  renderPainel();

  try {
    const dados = await api.posicaoLinha(linha.cl);
    if (versao !== versaoOnibus) return;
    aplicarPosicoes(dados);
    definirStatus('conectado', 'Conectado à SPTrans');
  } catch (erro) {
    if (versao !== versaoOnibus) return;
    estado.erroMapa = erro.message;
    definirStatus('erro', 'Falha na consulta');
  } finally {
    if (versao === versaoOnibus) {
      estado.carregandoOnibus = false;
      atualizarLegendaMapa();
      renderPainel();
    }
  }
}

async function atualizarPosicoesSilencioso() {
  const linha = estado.linhaNoMapa;
  if (!linha?.cl || estado.carregandoOnibus) return;

  const versao = versaoOnibus;
  estado.carregandoOnibus = true;

  try {
    const dados = await api.posicaoLinha(linha.cl);
    if (versao !== versaoOnibus) return;
    aplicarPosicoes(dados);
  } catch {
    // Mantém a última posição conhecida no mapa.
  } finally {
    if (versao === versaoOnibus) {
      estado.carregandoOnibus = false;
      atualizarLegendaMapa();
    }
  }
}

/* ---------- Painel de chegadas ---------- */

function renderAtualizadoEm() {
  if (estado.carregando && !estado.chegadas) {
    ui.atualizadoEm.textContent = 'Consultando a SPTrans…';
    return;
  }

  if (!estado.atualizadoEm) {
    ui.atualizadoEm.textContent = 'Aguardando dados…';
    return;
  }

  const hora = estado.atualizadoEm.toLocaleTimeString('pt-BR');
  if (!estado.autoAtualizar) {
    ui.atualizadoEm.textContent = `Atualizado às ${hora}`;
    return;
  }

  const segundos = estado.proximaAtualizacao
    ? Math.max(0, Math.ceil((estado.proximaAtualizacao - Date.now()) / 1000))
    : null;

  ui.atualizadoEm.textContent =
    segundos === null ? `Atualizado às ${hora}` : `Atualizado às ${hora} · próxima em ${segundos} s`;
}

function renderAvisoErro() {
  ui.avisoErro.replaceChildren();

  if (!estado.erro) {
    ui.avisoErro.classList.add('oculto');
    return;
  }

  ui.avisoErro.classList.remove('oculto');

  const texto = document.createElement('span');
  texto.textContent = estado.erro;

  const tentar = document.createElement('button');
  tentar.type = 'button';
  tentar.className = 'botao-texto';
  tentar.textContent = 'Tentar de novo';
  tentar.addEventListener('click', () => carregarChegadas());

  ui.avisoErro.append(texto, tentar);
}

function criarEsqueleto() {
  const item = document.createElement('li');
  item.className = 'esqueleto';
  item.setAttribute('aria-hidden', 'true');

  const linha1 = document.createElement('span');
  linha1.style.width = '38%';
  const linha2 = document.createElement('span');
  linha2.style.width = '62%';
  const linha3 = document.createElement('span');
  linha3.style.width = '48%';

  item.append(linha1, linha2, linha3);
  return item;
}

function criarItemVeiculo(veiculo, horaConsulta) {
  const item = document.createElement('li');
  item.className = 'veiculo';

  const minutos = minutosParaChegar(veiculo.t, horaConsulta);

  const destaque = document.createElement('span');
  destaque.className = 'veiculo-minutos';
  destaque.textContent = formatarMinutos(minutos);
  if (minutos !== null && minutos <= 2) destaque.classList.add('chegando');

  const hora = document.createElement('span');
  hora.className = 'veiculo-hora';
  hora.textContent = veiculo.t ? `previsto ${veiculo.t}` : 'horário indisponível';

  item.append(destaque, hora);

  if (veiculo.a) {
    const selo = document.createElement('span');
    selo.className = 'selo-acessivel';
    selo.textContent = '♿ acessível';
    selo.title = 'Veículo com acessibilidade';
    item.append(selo);
  }

  return item;
}

function criarItemLinha(linha, horaConsulta) {
  const item = document.createElement('li');
  item.className = 'linha';

  const cabecalho = document.createElement('div');
  cabecalho.className = 'linha-cabecalho';

  const letreiro = document.createElement('span');
  letreiro.className = 'letreiro';
  letreiro.textContent = linha.c ?? '—';

  const destino = document.createElement('span');
  destino.className = 'destino';
  destino.textContent = linha.lt1 || linha.lt0 || 'Destino não informado';
  destino.title = [linha.lt0, linha.lt1].filter(Boolean).join(' ⇄ ');

  cabecalho.append(letreiro, destino);

  if (linha.cl) {
    const noMapa = estado.linhaNoMapa?.cl === linha.cl;
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'botao-mapa';
    botao.textContent = noMapa ? 'Ocultar ônibus' : 'Ver ônibus';
    botao.setAttribute(
      'aria-label',
      `${noMapa ? 'Ocultar' : 'Ver'} os ônibus da linha ${linha.c} no mapa`,
    );
    botao.addEventListener('click', () => {
      if (noMapa) {
        limparOnibus();
        atualizarLegendaMapa();
        renderPainel();
      } else {
        carregarOnibusDaLinha(linha);
      }
    });
    cabecalho.append(botao);
  }

  item.append(cabecalho);

  const veiculos = Array.isArray(linha.vs)
    ? [...linha.vs].sort(
        (a, b) =>
          (minutosParaChegar(a.t, horaConsulta) ?? 999) -
          (minutosParaChegar(b.t, horaConsulta) ?? 999),
      )
    : [];

  if (veiculos.length === 0) {
    const vazio = document.createElement('p');
    vazio.className = 'sem-previsao';
    vazio.textContent = 'Sem previsão para este ponto agora.';
    item.append(vazio);
    return item;
  }

  const lista = document.createElement('ul');
  lista.className = 'veiculos';
  for (const veiculo of veiculos) lista.append(criarItemVeiculo(veiculo, horaConsulta));
  item.append(lista);

  return item;
}

function menorMinuto(linha, horaConsulta) {
  if (!Array.isArray(linha.vs)) return null;
  const valores = linha.vs
    .map((veiculo) => minutosParaChegar(veiculo.t, horaConsulta))
    .filter((valor) => valor !== null);
  return valores.length ? Math.min(...valores) : null;
}

function renderChegadas() {
  if (estado.carregando && !estado.chegadas) {
    ui.chegadas.replaceChildren(criarEsqueleto(), criarEsqueleto(), criarEsqueleto());
    ui.chegadasVazio.classList.add('oculto');
    return;
  }

  ui.chegadas.replaceChildren();

  const linhas = Array.isArray(estado.chegadas?.p?.l) ? estado.chegadas.p.l : [];
  const horaConsulta = estado.chegadas?.hr;

  if (linhas.length === 0) {
    const temDados = Boolean(estado.chegadas);
    ui.chegadasVazio.classList.toggle('oculto', !temDados || Boolean(estado.erro) || estado.carregando);
    return;
  }

  ui.chegadasVazio.classList.add('oculto');

  const ordenadas = [...linhas].sort((a, b) => {
    const minutoA = menorMinuto(a, horaConsulta);
    const minutoB = menorMinuto(b, horaConsulta);
    if (minutoA === null && minutoB === null) return String(a.c).localeCompare(String(b.c));
    if (minutoA === null) return 1;
    if (minutoB === null) return -1;
    return minutoA - minutoB;
  });

  const fragmento = document.createDocumentFragment();
  for (const linha of ordenadas) fragmento.append(criarItemLinha(linha, horaConsulta));
  ui.chegadas.append(fragmento);
}

function renderPainel() {
  ui.boasVindas.classList.toggle('oculto', Boolean(estado.parada));
  ui.painel.classList.toggle('oculto', !estado.parada);

  if (!estado.parada) return;

  const parada = { ...estado.parada, ...(estado.chegadas?.p ?? {}) };

  ui.paradaNome.textContent = parada.np ?? 'Ponto de ônibus';
  ui.paradaEndereco.textContent = parada.ed ?? '';
  ui.paradaCodigo.textContent = `Código ${parada.cp}`;

  const favorito = ehFavorito(estado.parada.cp);
  ui.botaoFavoritar.textContent = favorito ? '★' : '☆';
  ui.botaoFavoritar.classList.toggle('ativo', favorito);
  ui.botaoFavoritar.setAttribute('aria-pressed', String(favorito));
  ui.botaoFavoritar.setAttribute(
    'aria-label',
    favorito ? 'Remover ponto dos favoritos' : 'Adicionar ponto aos favoritos',
  );
  ui.botaoFavoritar.title = ui.botaoFavoritar.getAttribute('aria-label');

  ui.botaoAtualizar.disabled = estado.carregando;
  ui.botaoAtualizar.textContent = estado.carregando ? 'Atualizando…' : 'Atualizar';

  renderAvisoErro();
  renderAtualizadoEm();
  renderChegadas();
  atualizarLegendaMapa();
}

async function carregarChegadas({ silencioso = false } = {}) {
  if (!estado.parada || estado.carregando) return;

  const codigoParada = estado.parada.cp;
  const versao = ++versaoChegadas;

  estado.carregando = true;
  estado.erro = null;
  if (!silencioso) definirStatus('consultando', 'Consultando a SPTrans…');
  renderPainel();

  try {
    const dados = await api.previsaoParada(codigoParada);
    if (versao !== versaoChegadas) return;

    estado.chegadas = dados && typeof dados === 'object' ? dados : null;

    const ponto = estado.chegadas?.p;
    if (ponto?.cp) {
      estado.parada = {
        ...estado.parada,
        np: ponto.np ?? estado.parada.np,
        ed: ponto.ed ?? estado.parada.ed,
        py: ponto.py ?? estado.parada.py,
        px: ponto.px ?? estado.parada.px,
      };

      if (!estado.marcadorParada && coordenadasValidas(estado.parada)) {
        mostrarParadaNoMapa(estado.parada);
      }
    }

    estado.atualizadoEm = new Date();
    definirStatus('conectado', 'Conectado à SPTrans');
  } catch (erro) {
    if (versao !== versaoChegadas) return;
    estado.erro = erro.message;
    definirStatus('erro', 'Falha na consulta');
  } finally {
    if (versao === versaoChegadas) {
      estado.carregando = false;
      estado.proximaAtualizacao = Date.now() + INTERVALO_ATUALIZACAO_MS;
      renderPainel();

      if (estado.chegadas && estado.linhaNoMapa) {
        atualizarPosicoesSilencioso();
      }
    }
  }
}

/* ---------- Busca e favoritos ---------- */

function criarItemResultado(parada) {
  const item = document.createElement('li');
  item.className = 'resultado';

  const abrir = document.createElement('button');
  abrir.type = 'button';
  abrir.className = 'resultado-abrir';

  const nome = document.createElement('span');
  nome.className = 'resultado-nome';
  nome.textContent = parada.np ?? 'Ponto sem nome';

  const informacoes = document.createElement('span');
  informacoes.className = 'resultado-info';
  informacoes.textContent = parada.ed ?? `Código ${parada.cp}`;

  const distancia = distanciaAte(parada);
  if (distancia !== null) {
    informacoes.append(' · ');
    const destaque = document.createElement('span');
    destaque.className = 'resultado-distancia';
    destaque.textContent = formatarDistancia(distancia);
    informacoes.append(destaque);
  }

  abrir.append(nome, informacoes);
  abrir.addEventListener('click', () => selecionarParada(parada));

  const favoritar = document.createElement('button');
  favoritar.type = 'button';
  favoritar.className = 'resultado-favoritar';
  const favorito = ehFavorito(parada.cp);
  if (favorito) favoritar.classList.add('ativo');
  favoritar.textContent = favorito ? '★' : '☆';
  favoritar.title = favorito ? 'Remover dos favoritos' : 'Adicionar aos favoritos';
  favoritar.setAttribute('aria-label', `${favoritar.title}: ${parada.np ?? 'ponto'}`);
  favoritar.setAttribute('aria-pressed', String(favorito));
  favoritar.addEventListener('click', () => {
    alternarFavorito(parada);
    renderFavoritos();
    renderResultados();
    renderPainel();
  });

  item.append(abrir, favoritar);
  return item;
}

function renderResultados() {
  ui.resultados.replaceChildren();
  ui.buscaStatus.classList.remove('erro');

  if (estado.buscaCarregando) {
    ui.buscaStatus.textContent = 'Buscando pontos…';
    ui.buscaStatus.classList.remove('oculto');
    return;
  }

  if (estado.erroBusca) {
    ui.buscaStatus.textContent = estado.erroBusca;
    ui.buscaStatus.classList.add('erro');
    ui.buscaStatus.classList.remove('oculto');
    return;
  }

  if (estado.termoBusca.length >= MINIMO_CARACTERES_BUSCA && estado.resultados.length === 0) {
    ui.buscaStatus.textContent = 'Nenhum ponto encontrado. Tente outro nome ou endereço.';
    ui.buscaStatus.classList.remove('oculto');
    return;
  }

  if (estado.resultados.length > 0) {
    const total = estado.resultados.length;
    ui.buscaStatus.textContent = `${total} ${total === 1 ? 'ponto encontrado' : 'pontos encontrados'}.`;
    ui.buscaStatus.classList.remove('oculto');
  } else {
    ui.buscaStatus.textContent = '';
    ui.buscaStatus.classList.add('oculto');
  }

  const fragmento = document.createDocumentFragment();
  for (const parada of estado.resultados) fragmento.append(criarItemResultado(parada));
  ui.resultados.append(fragmento);
}

async function buscarPontos(termo) {
  estado.buscaCarregando = true;
  estado.erroBusca = null;
  renderResultados();

  try {
    const dados = await api.buscarParadas(termo);
    if (estado.termoBusca !== termo) return;
    estado.resultados = ordenarPorDistancia(Array.isArray(dados) ? dados : []);
  } catch (erro) {
    if (estado.termoBusca !== termo) return;
    estado.resultados = [];
    estado.erroBusca = erro.message;
  } finally {
    if (estado.termoBusca === termo) {
      estado.buscaCarregando = false;
      renderResultados();
    }
  }
}

function renderFavoritos() {
  const favoritos = listarFavoritos();
  ui.favoritos.replaceChildren();
  ui.favoritosVazio.classList.toggle('oculto', favoritos.length > 0);

  const fragmento = document.createDocumentFragment();

  for (const favorito of favoritos) {
    const item = document.createElement('li');

    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'chip';
    botao.title = `Abrir ${favorito.np ?? 'ponto'}`;

    const nome = document.createElement('span');
    nome.className = 'chip-nome';
    nome.textContent = favorito.np ?? `Ponto ${favorito.cp}`;

    const codigo = document.createElement('span');
    codigo.className = 'chip-codigo';
    codigo.textContent = favorito.cp;

    botao.append(nome, codigo);
    botao.addEventListener('click', () => selecionarParada(favorito));

    item.append(botao);
    fragmento.append(item);
  }

  ui.favoritos.append(fragmento);
}

/* ---------- Navegação ---------- */

function selecionarParada(parada, { rolar = true } = {}) {
  if (!parada?.cp) return;

  versaoChegadas += 1;
  estado.carregando = false;
  estado.parada = { ...parada };
  estado.chegadas = null;
  estado.erro = null;
  estado.atualizadoEm = null;
  estado.proximaAtualizacao = null;
  estado.resultados = [];
  estado.termoBusca = '';
  estado.erroBusca = null;
  estado.buscaCarregando = false;

  ui.campoBusca.value = '';
  clearTimeout(temporizadorBusca);
  temporizadorBusca = null;

  limparOnibus();
  if (estado.marcadorParada) {
    estado.marcadorParada.remove();
    estado.marcadorParada = null;
  }

  if (coordenadasValidas(estado.parada)) {
    mostrarParadaNoMapa(estado.parada);
  } else if (estado.mapa) {
    estado.mapa.setView(CENTRO_SAO_PAULO, 12);
  }

  salvarUltimaParada(estado.parada);
  renderResultados();
  renderFavoritos();
  renderPainel();
  carregarChegadas();

  if (rolar && window.matchMedia('(max-width: 940px)').matches) {
    ui.painel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

/* ---------- Eventos ---------- */

function configurarEventos() {
  ui.campoBusca.addEventListener('input', () => {
    const termo = ui.campoBusca.value.trim();
    estado.termoBusca = termo;
    estado.erroBusca = null;
    clearTimeout(temporizadorBusca);

    if (termo.length < MINIMO_CARACTERES_BUSCA) {
      estado.resultados = [];
      estado.buscaCarregando = false;
      renderResultados();
      return;
    }

    estado.buscaCarregando = true;
    renderResultados();
    temporizadorBusca = setTimeout(() => buscarPontos(termo), 450);
  });

  ui.campoBusca.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Enter') return;
    evento.preventDefault();

    const termo = ui.campoBusca.value.trim();
    clearTimeout(temporizadorBusca);
    if (termo.length >= MINIMO_CARACTERES_BUSCA) buscarPontos(termo);
  });

  ui.botaoAtualizar.addEventListener('click', () => carregarChegadas());

  ui.botaoFavoritar.addEventListener('click', () => {
    if (!estado.parada) return;
    alternarFavorito(estado.parada);
    renderFavoritos();
    renderPainel();
  });

  ui.autoAtualizar.addEventListener('change', () => {
    estado.autoAtualizar = ui.autoAtualizar.checked;
    salvarAutoAtualizar(estado.autoAtualizar);
    if (estado.autoAtualizar) {
      estado.proximaAtualizacao = Date.now() + INTERVALO_ATUALIZACAO_MS;
    }
    renderAtualizadoEm();
  });

  ui.botaoLocalizacao.addEventListener('click', () => {
    if (!navigator.geolocation) {
      estado.erroBusca = 'Seu navegador não oferece localização.';
      renderResultados();
      return;
    }

    ui.botaoLocalizacao.disabled = true;
    ui.botaoLocalizacao.textContent = '📍 Obtendo localização…';

    navigator.geolocation.getCurrentPosition(
      (posicao) => {
        estado.posicaoUsuario = {
          lat: posicao.coords.latitude,
          lng: posicao.coords.longitude,
        };
        ui.botaoLocalizacao.textContent = '📍 Localização ativa';
        estado.resultados = ordenarPorDistancia(estado.resultados);
        renderResultados();
      },
      () => {
        ui.botaoLocalizacao.disabled = false;
        ui.botaoLocalizacao.textContent = '📍 Usar minha localização';
        estado.erroBusca = 'Não foi possível obter sua localização. Verifique a permissão do navegador.';
        renderResultados();
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (
      estado.autoAtualizar &&
      estado.parada &&
      !estado.carregando &&
      estado.proximaAtualizacao &&
      Date.now() >= estado.proximaAtualizacao
    ) {
      carregarChegadas({ silencioso: true });
    }
  });

  window.setInterval(() => {
    if (!estado.parada) return;
    renderAtualizadoEm();

    if (!estado.autoAtualizar || estado.carregando || document.hidden) return;
    if (estado.proximaAtualizacao && Date.now() >= estado.proximaAtualizacao) {
      carregarChegadas({ silencioso: true });
    }
  }, 1000);
}

/* ---------- Inicialização ---------- */

estado.autoAtualizar = lerAutoAtualizar();
ui.autoAtualizar.checked = estado.autoAtualizar;

configurarEventos();
obterMapa();
renderFavoritos();

if (window.location.protocol === 'file:') {
  estado.erroBusca =
    'Este app precisa do servidor local para consultar a SPTrans. Rode "npm run dev" e abra http://localhost:3000.';
}

renderResultados();

const ultimaParada = lerUltimaParada();
if (ultimaParada) selecionarParada(ultimaParada, { rolar: false });
