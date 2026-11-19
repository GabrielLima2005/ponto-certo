<p align="center">
  <img src="assets/banner.svg" alt="Ponto Certo — seu ônibus de São Paulo em tempo real" width="100%" />
</p>

<p align="center">
  <a href="#funcionalidades">Funcionalidades</a> ·
  <a href="#arquitetura">Arquitetura</a> ·
  <a href="#como-rodar-localmente">Como rodar</a> ·
  <a href="#deploy-na-vercel">Deploy</a> ·
  <a href="#equipe">Equipe</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5" />
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3" />
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript" />
  <img src="https://img.shields.io/badge/Node.js-22%2B-5FA04E?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js 22+" />
  <img src="https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel" />
  <img src="https://img.shields.io/badge/API-SPTrans%20Olho%20Vivo-facc15?style=for-the-badge&logoColor=black" alt="API SPTrans Olho Vivo" />
</p>

# Ponto Certo

**Quanto falta para o ônibus chegar?** O Ponto Certo consulta a API Olho Vivo da SPTrans e mostra, em tempo real, as próximas chegadas em qualquer ponto de São Paulo — com mapa dos veículos, favoritos e atualização automática.

Projeto acadêmico da **Global Solution 2026.2 — FIAP**, curso de Ciência da Computação, na área de desafio **Citizen Intelligence & Predictive Analytics**.

## Funcionalidades

| Recurso | Descrição |
| --- | --- |
| Busca de pontos | Pesquisa por nome ou endereço direto na base da SPTrans, com ordenação por distância quando a localização é permitida |
| Painel de chegadas | Linhas do ponto ordenadas pela próxima chegada, horário previsto e selo de veículo acessível |
| Atualização automática | Consultas a cada 30 segundos com contador regressivo, atualização manual e pausa quando a aba fica em segundo plano |
| Favoritos | Pontos salvos no navegador (`localStorage`) para acesso com um clique |
| Mapa interativo | Localização do ponto e posição dos ônibus de cada linha no mapa (Leaflet + OpenStreetMap) |
| Responsivo e acessível | Layout para celular e desktop, tema escuro de alto contraste, navegação por teclado e suporte a `prefers-reduced-motion` |

## Telas

| Desktop | Mobile |
| :---: | :---: |
| <img src="assets/desktop.png" alt="Painel de chegadas do Ponto Certo" width="640" /> | <img src="assets/mobile.png" alt="Versão mobile do Ponto Certo" width="280" /> |

<p align="center">
  <img src="assets/mapa.jpg" alt="Mapa com a posição dos ônibus em tempo real" width="760" />
</p>

## Arquitetura

```
┌─────────────────────┐        GET /api/olhovivo?path=...       ┌─────────────────────┐
│     Navegador       │ ─────────────────────────────────────► │  Função serverless  │
│  HTML · CSS · JS    │ ◄───────────────────────────────────── │  (Vercel / Node)    │
└─────────────────────┘          JSON (sem token)              └──────────┬──────────┘
                                                                          │ login + cookie
                                                                          ▼
                                                               ┌─────────────────────┐
                                                               │   API Olho Vivo     │
                                                               │   SPTrans v2.1      │
                                                               └─────────────────────┘
```

A API Olho Vivo exige **token** e uma **sessão por cookie**. O navegador nunca fala com a SPTrans diretamente: uma função serverless faz o login, mantém a sessão em memória e repassa as consultas autenticadas.

| Decisão | Motivo |
| --- | --- |
| Proxy serverless | Mantém o token fora do código do cliente e resolve o CORS da API da SPTrans |
| Sessão em cache por 25 minutos | Evita logins repetidos e respeita o limite de sessões da API |
| Lista de endpoints permitidos | Impede que o proxy seja usado para acessar rotas arbitrárias |
| Contadores de versão nas requisições | Respostas antigas não sobrescrevem uma busca ou linha selecionada depois |
| Atualização a cada 30 segundos | Dados frescos sem sobrecarregar a API pública |
| Sem dependências de runtime | Build instantâneo; apenas Leaflet via CDN |

### Endpoints utilizados

| Uso no app | Endpoint da API |
| --- | --- |
| Buscar pontos por nome ou endereço | `GET /Parada/Buscar?termosBusca=` |
| Previsão de chegadas do ponto | `GET /Previsao/Parada?codigoParada=` |
| Posição dos ônibus de uma linha | `GET /Posicao/Linha?codigoLinha=` |
| Login (somente no servidor) | `POST /Login/Autenticar?token=` |

## Como rodar localmente

**Pré-requisitos:** Node.js 22.9 ou superior e um token da SPTrans.

1. Gere seu token na [área de desenvolvedores da SPTrans](https://www.sptrans.com.br/desenvolvedores/) em **Meus Aplicativos**. A liberação pode não ser imediata.
2. Crie o arquivo de ambiente:

   ```bash
   cp .env.example .env
   ```

   ```env
   OLHO_VIVO_TOKEN=cole_seu_token_aqui
   ```

3. Inicie o servidor — não há dependências para instalar:

   ```bash
   npm run dev
   ```

4. Abra <http://localhost:3000>.

O `server.js` entrega os arquivos estáticos e responde `/api/olhovivo` com a mesma lógica da função da Vercel. Para usar outra porta: `PORT=3100 npm run dev` (no PowerShell: `$env:PORT=3100; npm run dev`).

## Deploy na Vercel

1. Envie o projeto para um repositório no GitHub:

   ```bash
   git init
   git add .
   git commit -m "Ponto Certo: app com a API Olho Vivo"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/ponto-certo.git
   git push -u origin main
   ```

2. Em [vercel.com](https://vercel.com), use **Add New → Project** e importe o repositório.
3. Framework Preset: **Other**. Build Command e Output Directory ficam vazios.
4. Em **Environment Variables**, adicione `OLHO_VIVO_TOKEN` com o seu token.
5. Clique em **Deploy** e abra a URL `https://seu-projeto.vercel.app`.

A Vercel detecta o site estático na raiz e a função em `api/`. Ao trocar o token, atualize a variável e faça **Redeploy**. O arquivo `.env` nunca deve ir para o repositório — ele já está no `.gitignore`.

## Estrutura do projeto

```
index.html              Página única do app
css/styles.css          Tema escuro e layout responsivo
js/app.js               Estado, painel, busca, mapa e atualização automática
js/api.js               Chamadas ao proxy /api/olhovivo
js/storage.js           Favoritos e preferências no localStorage
api/olhovivo.js         Função serverless (proxy)
api/_lib/olhovivo.js    Login, sessão e consultas à API da SPTrans
server.js               Servidor local de desenvolvimento
assets/                 Banner e capturas de tela
.env.example            Modelo da variável de ambiente
PARTICIPANTES.txt       Integrantes e divisão do trabalho
```

## Limitações

- As previsões dependem dos dados enviados pelos veículos; pontos sem GPS podem ficar sem previsão.
- A atualização automática é de 30 segundos para não sobrecarregar a API pública.
- Os favoritos ficam apenas no navegador — não há cadastro de usuários.

## Equipe

Os integrantes e a divisão do trabalho estão em [`PARTICIPANTES.txt`](PARTICIPANTES.txt).

## Créditos

- Dados de transporte: [SPTrans — API Olho Vivo](https://www.sptrans.com.br/desenvolvedores/)
- Mapas: [OpenStreetMap](https://www.openstreetmap.org/copyright)
- Biblioteca de mapas: [Leaflet](https://leafletjs.com/)

Projeto acadêmico desenvolvido para a Global Solution 2026.2 da FIAP.
