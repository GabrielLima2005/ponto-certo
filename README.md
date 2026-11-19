<h1 align="center">Ponto Certo</h1>

<p align="center">
  <strong>Seu ônibus de São Paulo, em tempo real.</strong><br />
  Busque um ponto, veja as próximas chegadas e acompanhe os veículos no mapa — com dados oficiais da SPTrans.
</p>

<p align="center">
  <kbd>HTML5</kbd> <kbd>CSS3</kbd> <kbd>JavaScript</kbd> <kbd>Node.js 22+</kbd> <kbd>Vercel</kbd> <kbd>API Olho Vivo</kbd>
</p>

<p align="center">
  <a href="#sobre">Sobre</a> ·
  <a href="#funcionalidades">Funcionalidades</a> ·
  <a href="#arquitetura">Arquitetura</a> ·
  <a href="#como-rodar-localmente">Rodar localmente</a> ·
  <a href="#deploy-na-vercel">Deploy</a> ·
  <a href="#equipe">Equipe</a>
</p>

---

## Sobre

> **Global Solution 2026.2 — FIAP**
> Application Development · Citizen Intelligence & Predictive Analytics

Em São Paulo, quem depende de ônibus conhece a cena: chegar ao ponto e não saber se o próximo veículo vem em dois minutos ou em meia hora. O **Ponto Certo** transforma os dados abertos da SPTrans em uma resposta direta — quanto falta, qual linha, de onde ela vem e onde o ônibus está agora.

O projeto foi construído do zero com **HTML, CSS e JavaScript puro**, sem framework de front-end e sem etapa de build. A única dependência em execução é uma pequena função serverless que protege o token de acesso e conversa com a API Olho Vivo.

**Status:** funcional com dados reais da API Olho Vivo, validado em desktop e celular.

### O problema e a resposta

| A dor de quem espera | O que o app entrega |
| --- | --- |
| Não saber quando o ônibus chega | Previsão oficial ordenada pela próxima chegada, com horário previsto |
| Informação espalhada em vários lugares | Um painel único por ponto, com todas as linhas que passam ali |
| Não saber onde o veículo está | Mapa com a posição real dos ônibus de cada linha |
| Uso rápido na rua | Layout mobile, tema escuro de alto contraste e atualização automática |
| Falta de informação sobre acessibilidade | Selo de veículo acessível em cada previsão |

## Funcionalidades

| Recurso | Descrição |
| --- | --- |
| Busca de pontos | Pesquisa por nome ou endereço direto na base da SPTrans, com ordenação por distância quando a localização é permitida |
| Painel de chegadas | Linhas do ponto ordenadas pela próxima chegada, horário previsto e selo de veículo acessível |
| Atualização automática | Consultas a cada 30 segundos com contador regressivo, atualização manual e pausa quando a aba fica em segundo plano |
| Favoritos | Pontos salvos no navegador (`localStorage`) para acesso com um clique |
| Mapa interativo | Localização do ponto e posição dos ônibus de cada linha no mapa (Leaflet + OpenStreetMap) |
| Responsivo e acessível | Layout para celular e desktop, navegação por teclado, foco visível e suporte a `prefers-reduced-motion` |
| Tratamento de concorrência | Requisições antigas não sobrescrevem buscas ou linhas selecionadas depois |

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

**Por que o proxy existe:**

1. **Segurança** — o token fica apenas nas variáveis de ambiente do servidor, nunca no código entregue ao navegador.
2. **CORS** — a API da SPTrans não aceita chamadas diretas de qualquer origem; o navegador conversa apenas com a mesma origem do app.
3. **Sessão** — o login e o cookie são centralizados no servidor, sem expor credenciais ao cliente.

### Stack

| Camada | Tecnologia | Papel no projeto |
| --- | --- | --- |
| Interface | HTML5, CSS3 e JavaScript (ES Modules) | Página única, componentes renderizados no DOM e estado controlado sem framework |
| Mapas | Leaflet + OpenStreetMap | Mapa interativo com marcadores personalizados e tema escuro |
| Back-end | Node.js na função serverless da Vercel | Proxy autenticado, sessão em memória e lista de endpoints permitidos |
| Persistência | `localStorage` | Favoritos, última parada aberta e preferência de atualização automática |
| Deploy | Vercel | Site estático na raiz e função em `api/`, sem build |
| Desenvolvimento | Node.js 22.9+ | Servidor local que reproduz o comportamento da produção |

### API Olho Vivo

| Uso no app | Endpoint |
| --- | --- |
| Buscar pontos por nome ou endereço | `GET /Parada/Buscar?termosBusca=` |
| Previsão de chegadas do ponto | `GET /Previsao/Parada?codigoParada=` |
| Posição dos ônibus de uma linha | `GET /Posicao/Linha?codigoLinha=` |
| Login (somente no servidor) | `POST /Login/Autenticar?token=` |

## Como rodar localmente

**Pré-requisitos:** Node.js 22.9 ou superior e um token da SPTrans. O projeto não possui dependências para instalar.

1. Gere seu token na [área de desenvolvedores da SPTrans](https://www.sptrans.com.br/desenvolvedores/), em **Meus Aplicativos**. A liberação pode não ser imediata.
2. Crie o arquivo de ambiente e informe o token:

   ```bash
   cp .env.example .env
   ```

   ```env
   OLHO_VIVO_TOKEN=cole_seu_token_aqui
   ```

3. Inicie o servidor:

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
.env.example            Modelo da variável de ambiente
PARTICIPANTES.txt       Integrantes e divisão do trabalho
```

## Decisões técnicas

| Decisão | Motivo |
| --- | --- |
| Proxy serverless | Mantém o token fora do código do cliente e resolve o CORS |
| Sessão em cache por 25 minutos | Evita logins repetidos e respeita o limite de sessões da API |
| Lista de endpoints permitidos | Impede que o proxy seja usado para acessar rotas arbitrárias |
| Contadores de versão nas requisições | Respostas antigas não sobrescrevem uma busca ou linha selecionada depois |
| Atualização a cada 30 segundos | Dados frescos sem sobrecarregar a API pública |
| Mapa escuro com filtro CSS | Visual consistente sem depender de chave de API paga |
| Sem dependências de runtime | Build instantâneo; apenas Leaflet via CDN |

## Acessibilidade e experiência

- Link "Pular para o conteúdo" e marcos semânticos (`header`, `main`, `nav`, `footer`).
- Rótulos, estados e mensagens anunciados com ARIA e regiões `live`.
- Navegação completa por teclado, com foco visível em todos os controles.
- Contraste alto no tema escuro e respeito a `prefers-reduced-motion`.
- Feedback de carregamento com esqueleto de tela e mensagens de erro em português.

## Limitações

- As previsões dependem dos dados enviados pelos veículos; pontos sem GPS podem ficar sem previsão.
- A atualização automática é de 30 segundos para não sobrecarregar a API pública.
- Os favoritos ficam apenas no navegador — não há cadastro de usuários.
- A sessão da API é mantida por instância da função serverless; em produção, cada instância faz seu próprio login.

## Equipe

Os integrantes e a divisão do trabalho estão em [`PARTICIPANTES.txt`](PARTICIPANTES.txt).

## Créditos

- Dados de transporte: [SPTrans — API Olho Vivo](https://www.sptrans.com.br/desenvolvedores/)
- Mapas: [OpenStreetMap](https://www.openstreetmap.org/copyright)
- Biblioteca de mapas: [Leaflet](https://leafletjs.com/)

Projeto acadêmico desenvolvido para a Global Solution 2026.2 da FIAP, sem fins comerciais.
