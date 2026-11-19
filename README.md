# Ponto Certo 🚌

Aplicativo web feito com **HTML, CSS e JavaScript puro** que usa a **API Olho Vivo da SPTrans** para mostrar, em tempo real, quanto falta para o seu ônibus chegar em qualquer ponto de São Paulo.

Projeto da Global Solution 2026.2 — FIAP (Application Development) — área de desafio *Citizen Intelligence & Predictive Analytics*.

## O que o app faz

- **Busca de pontos** por nome ou endereço, com distância opcional a partir da sua localização.
- **Painel de chegadas** com as linhas do ponto, tempo estimado (calculado a partir da previsão oficial), horário previsto e selo de veículo acessível (♿).
- **Atualização automática a cada 30 segundos**, com contador visível, botão de atualização manual e pausa quando a aba está em segundo plano.
- **Pontos favoritos** salvos no navegador (`localStorage`), acessíveis com um toque.
- **Mapa** com a localização do ponto e a posição dos ônibus de cada linha.
- **Layout responsivo** (celular e desktop) e tema escuro de alto contraste.

## Como funciona

```
Navegador (HTML/CSS/JS)  ──GET /api/olhovivo?path=...──►  Função serverless  ──►  API Olho Vivo
                                                          (token + cookie)
```

A API Olho Vivo exige um **token** e uma **sessão por cookie**. Por isso o app não chama a SPTrans direto do navegador: uma pequena função serverless faz o login, guarda o cookie de sessão em memória e repassa as consultas.

Esse proxy resolve dois problemas:

1. **Segurança** — o token fica apenas nas variáveis de ambiente do servidor, nunca no código entregue ao navegador.
2. **CORS** — a API da SPTrans não permite chamadas diretas de qualquer origem; o navegador conversa só com a mesma origem do app.

### Endpoints utilizados

| Uso no app | Endpoint da API |
| --- | --- |
| Buscar pontos por nome/endereço | `GET /Parada/Buscar?termosBusca=` |
| Previsão de chegadas do ponto | `GET /Previsao/Parada?codigoParada=` |
| Posição dos ônibus de uma linha | `GET /Posicao/Linha?codigoLinha=` |
| Login (somente no servidor) | `POST /Login/Autenticar?token=` |

## Rodar localmente

Pré-requisitos: **Node.js 22.9 ou superior** e um **token da SPTrans**.

1. Crie sua conta na [área de desenvolvedores da SPTrans](https://www.sptrans.com.br/desenvolvedores/), abra **Meus Aplicativos** e gere um token para um novo aplicativo. A liberação pode não ser imediata.
2. Copie o arquivo de exemplo e coloque o token:

   ```bash
   cp .env.example .env
   ```

   ```env
   OLHO_VIVO_TOKEN=cole_seu_token_aqui
   ```

3. Inicie o servidor (o projeto não tem dependências para instalar):

   ```bash
   npm run dev
   ```

4. Abra <http://localhost:3000>.

> O servidor local (`server.js`) entrega os arquivos estáticos e responde `/api/olhovivo` com a mesma lógica da função serverless da Vercel.

## Publicar no Vercel

1. Crie um repositório no GitHub e envie o projeto:

   ```bash
   git init
   git add .
   git commit -m "Ponto Certo: app com a API Olho Vivo"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/ponto-certo.git
   git push -u origin main
   ```

2. Entre em [vercel.com](https://vercel.com) e faça **Sign Up com GitHub**.
3. Clique em **Add New → Project** e importe o repositório.
4. Em **Environment Variables**, adicione `OLHO_VIVO_TOKEN` com o seu token (marque Production, Preview e Development).
5. Clique em **Deploy** e aguarde cerca de um minuto.
6. Abra a URL `https://seu-projeto.vercel.app` e confira.

O Vercel detecta o site estático na raiz e a função em `api/`. Não é necessário build. Se trocar o token, atualize a variável e faça **Redeploy**.

> Nunca envie o arquivo `.env` para o GitHub — ele já está no `.gitignore`.

## Estrutura do projeto

```
index.html              Página única do app
css/styles.css          Tema escuro, layout responsivo
js/app.js               Estado da aplicação, painel, busca, mapa e atualização automática
js/api.js               Chamadas ao proxy /api/olhovivo
js/storage.js           Favoritos e preferências no localStorage
api/olhovivo.js         Função serverless da Vercel (proxy)
api/_lib/olhovivo.js    Login, cookie de sessão e consultas à API da SPTrans
server.js               Servidor local de desenvolvimento
.env.example            Modelo da variável de ambiente
PARTICIPANTES.txt       Integrantes do grupo e divisão do trabalho
```

## Dados e créditos

- Dados de transporte: [SPTrans — API Olho Vivo](https://www.sptrans.com.br/desenvolvedores/).
- Mapas: [OpenStreetMap](https://www.openstreetmap.org/copyright).
- Biblioteca de mapas: [Leaflet](https://leafletjs.com/).

## Limitações

- As previsões dependem dos dados enviados pelos veículos; pontos sem GPS podem ficar sem previsão.
- A atualização automática é de 30 segundos para não sobrecarregar a API pública.
- Os favoritos ficam apenas no navegador — não há cadastro de usuários.

## Integrantes

Veja o arquivo [`PARTICIPANTES.txt`](PARTICIPANTES.txt) com o nome dos integrantes e a divisão do trabalho.
