# Sistema de Contagem — AC Acessórios (Next.js)

Aplicativo web usado pelos conferentes para registrar a contagem física do
estoque. Funciona **sem conexão**: tudo o que é digitado é gravado no próprio
dispositivo e enviado ao servidor assim que a rede volta.

Porte do aplicativo original (PWA sem build, em `../contagem-app-pwa`) para
Next.js + TypeScript. Mesmas telas, mesmas regras, mesma paleta.

- **Versão:** 2.0.0
- **Backend:** API Estoque Service
- **Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Dexie

---

## Índice

1. [Funcionalidades](#funcionalidades)
2. [Requisitos](#requisitos)
3. [Executando localmente](#executando-localmente)
4. [Configuração](#configuração)
5. [Estrutura do projeto](#estrutura-do-projeto)
6. [Rotas](#rotas)
7. [Como funciona](#como-funciona)
8. [Publicação](#publicação)
9. [Docker e EasyPanel](#docker-e-easypanel)
10. [Convenções de código](#convenções-de-código)
11. [Solução de problemas](#solução-de-problemas)

---

## Funcionalidades

- Login do conferente pelo código de usuário.
- Lista das contagens liberadas para o usuário ("Minhas Tarefas").
- Conferência item a item, com soma automática de um mesmo produto espalhado por
  várias localizações.
- Comparação com o estoque do sistema e sinalização visual de divergência.
- Operação sem conexão com fila de sincronização automática.
- Retomada da contagem exatamente onde parou após recarregar a página.
- Instalação como aplicativo (PWA) com cache do app shell.

---

## Requisitos

| Item      | Versão              | Observação                                       |
|-----------|---------------------|--------------------------------------------------|
| Navegador | Chrome/Edge 90+     | Requer suporte a IndexedDB e Service Worker.     |
| Node.js   | 20+                 | Exigido pelo Next.js 16.                         |
| Backend   | API Estoque Service | Ver [Configuração](#configuração).               |

---

## Executando localmente

```bash
npm install
```

```bash
npm run dev
```

O app sobe em `http://localhost:3000`.

---

## Configuração

O endereço do backend vem do arquivo de ambiente. Copie o exemplo e ajuste:

```bash
cp .env.example .env.local
```

| Variável                   | Descrição                                       |
|----------------------------|-------------------------------------------------|
| `NEXT_PUBLIC_API_BASE_URL` | URL base da API Estoque Service, sem barra final |

> O prefixo `NEXT_PUBLIC_` é obrigatório — a chamada à API acontece no
> navegador. E o valor é **gravado dentro do bundle** durante o `next build`:
> mudar o endereço exige um novo build, não basta reiniciar o servidor.

Se a variável não for definida, o endereço é deduzido do hostname (o mesmo
comportamento do aplicativo original):

| Hostname                  | Ambiente      | URL da API                                  |
|---------------------------|---------------|---------------------------------------------|
| `localhost` / `127.0.0.1` | `development` | `http://localhost:8000`                     |
| qualquer outro            | `production`  | `http://estoque-service.acacessorios.local` |

Os demais ajustes ficam em [`lib/config.ts`](lib/config.ts): `REQUEST_TIMEOUT`,
`EMPRESA_ID`, `DATABASE.VERSION`, `STORAGE_KEYS`, `SYNC.*` e
`SERVICE_WORKER_ENABLED`. Nenhum outro arquivo contém valor de ambiente.

---

## Estrutura do projeto

```
contagem-app/
├── app/                        Rotas (App Router)
│   ├── layout.tsx              Providers globais, metadados e PWA
│   ├── globals.css             Estilos da aplicação (tokens + BEM)
│   ├── page.tsx                Rota inicial: decide para onde ir
│   ├── login/page.tsx          Tela 1 — autenticação
│   ├── contagens/page.tsx      Tela 2 — Minhas Tarefas
│   └── itens/page.tsx          Tela 3 — conferência
├── components/                 Componentes de apresentação
│   ├── AppProviders.tsx        Inicialização (equivale ao antigo main.js)
│   ├── AppHeader.tsx           Cabeçalho e logout
│   ├── ContagemCard.tsx        Cartão da lista de tarefas
│   ├── ItemCard.tsx            Cartão de item + campo de quantidade
│   ├── SyncStatus.tsx          Selo de conexão e fila pendente
│   ├── EmptyState.tsx          Estados vazios
│   ├── Spinner.tsx             Indicador de carregamento
│   └── MaterialIcon.tsx        Ícone da fonte Material Icons
├── hooks/                      Estado e regras de negócio
│   ├── useSession.tsx          Usuário autenticado e contagem aberta
│   ├── useToast.tsx            Mensagens curtas (snackbar)
│   ├── useSync.ts              Estado da fila de sincronização
│   ├── useUnloadGuard.tsx      Confirmação antes de recarregar
│   ├── useContagens.ts         Carregamento offline-first das tarefas
│   └── useItensConferencia.ts  Conferência dos itens (regra central)
├── lib/                        Infraestrutura, sem React
│   ├── config.ts               Configuração (único ponto de verdade)
│   ├── logger.ts               Log com escopo
│   ├── format.ts               Data/hora, quantidade, comparação de ids
│   ├── http.ts                 fetch com timeout e HttpError
│   ├── storage.ts              localStorage com JSON e tolerância a falhas
│   ├── database.ts             IndexedDB via Dexie
│   ├── api.ts                  Contrato com o backend
│   ├── sync.ts                 Fila offline e eventos de sincronização
│   └── types.ts                Tipos do domínio
├── public/
│   ├── manifest.json           Metadados do PWA
│   ├── service-worker.js       Cache do app shell
│   ├── assets/                 Logotipos
│   └── icons/                  Ícones do PWA
├── Dockerfile                  Imagem de produção (build em três estágios)
└── .dockerignore               O que nunca entra na imagem
```

Regra de dependência: `lib/` não conhece React nem `hooks/`; `hooks/` usa
`lib/`; `components/` e `app/` usam ambos. Nada em `lib/` importa de cima.

---

## Rotas

O aplicativo original era uma SPA de três telas alternadas por classe CSS; aqui
cada tela é uma rota de verdade, com o mesmo encadeamento:

| Rota         | Tela                  | Quando redireciona                                   |
|--------------|-----------------------|------------------------------------------------------|
| `/`          | —                     | Sem sessão → `/login`; contagem aberta → `/itens`; caso contrário → `/contagens` |
| `/login`     | Acesso ao sistema     | Autenticado → `/contagens` ao concluir o login       |
| `/contagens` | Minhas Tarefas        | Sem sessão → `/login`. Abrir a tela fecha a contagem em andamento |
| `/itens`     | Itens para Conferência| Sem sessão → `/login`; sem contagem aberta → `/contagens` |

---

## Como funciona

### Registro de uma contagem (offline-first)

```
Conferente digita a quantidade e aciona "Salvar"
        │
        ├─ 1. grava no IndexedDB  ......................  sempre, mesmo offline
        │
        ├─ 2. com conexão: consulta o estoque do sistema,
        │     compara com a soma do produto e informa o
        │     resultado à API
        │
        └─ 3. sem conexão (ou API indisponível): o item entra
              na fila e é marcado para revalidação
```

A fila é drenada automaticamente ao salvar um item, ao voltar a conexão, na
abertura do aplicativo e antes de concluir a contagem.

### Sinalização visual do campo de quantidade

| Cor           | Significado                                            |
|---------------|--------------------------------------------------------|
| 🔵 Azul       | Salvo no dispositivo, ainda não conferido no servidor  |
| 🟢 Verde      | Conferido: a soma bate com o estoque do sistema        |
| 🟠 Laranja    | Conferido: divergência em relação ao sistema           |
| 🔴 Vermelho   | Falha ao gravar no dispositivo (refazer o lançamento)  |

### Conclusão da contagem

Exige conexão: a liberação é uma operação do servidor. Antes de liberar, o app
força uma sincronização, envia o indicador de divergência e a lista de itens que
não puderam ser conferidos online. Concluída a contagem, os registros locais
daquele número são apagados — é o que impede que uma contagem futura com o mesmo
número reapareça preenchida.

### Contrato com a API

| Método | Rota                                              | Uso                                  |
|--------|---------------------------------------------------|--------------------------------------|
| POST   | `/login`                                          | Autenticação do conferente.          |
| GET    | `/estoque/contagem/{usuarioId}`                   | Contagens do usuário.                |
| GET    | `/estoque/contagem/conferir/{codProduto}?empresa=`| Estoque do produto no sistema.       |
| PUT    | `/estoque/contagem/item/{identificadorItem}`      | Marca o item como conferido ou não.  |
| PUT    | `/estoque/contagem/liberar`                       | Conclui a contagem.                  |
| POST   | `/estoque/contagem/log`                           | Registra uma quantidade contada.     |

> `id` chega ora como número, ora como texto. Compare com `format.sameId`,
> nunca com `===`.

### Banco local (IndexedDB)

Banco `ContagemAppDB`, schema versão 5 — o mesmo do aplicativo original, o que
permite que um dispositivo migre sem perder a fila pendente.

Ciclo de vida de um log: `addLog` (`synced=0`) → `markLogSynced` (`synced=1`) →
`deleteLogsByContagem` na conclusão. Registros já enviados são mantidos até a
conclusão de propósito: é o que permite reabrir a contagem e continuar vendo as
quantidades digitadas.

Para alterar o schema, adicione um novo `this.version(N).stores({...})` em
[`lib/database.ts`](lib/database.ts) **sem remover as versões anteriores** e
atualize `DATABASE.VERSION` em `lib/config.ts`.

---

## Publicação

1. Incremente a versão em **dois** lugares (eles precisam bater):
   - `lib/config.ts` → `VERSION`
   - `public/service-worker.js` → `CACHE_VERSION`
2. Defina `NEXT_PUBLIC_API_BASE_URL` no ambiente de build.
3. `npm run build && npm start`.

Sem o passo 1 os dispositivos continuam servindo os arquivos do cache antigo.

> Diferença em relação ao PWA original: o Next gera nomes de bundle novos a cada
> build, então o Service Worker não pré-cacheia uma lista fixa de arquivos — o
> app shell é preenchido conforme as páginas são visitadas.

---

## Docker e EasyPanel

O [`Dockerfile`](Dockerfile) faz um build em três estágios e publica apenas o
servidor autocontido (`output: 'standalone'` em `next.config.ts`): a imagem
final não carrega o código-fonte nem as dependências de desenvolvimento.

### Localmente

```bash
docker build --build-arg NEXT_PUBLIC_API_BASE_URL=http://estoque-service.acacessorios.local -t contagem-app .
```

```bash
docker run --rm -p 3000:3000 contagem-app
```

### EasyPanel

1. **Source** — aponte para o repositório (o `Dockerfile` está na raiz deste
   projeto). Se o repositório tiver os dois aplicativos, informe `contagem-app`
   como *Build path*.
2. **Build** — método **Dockerfile**.
3. **Build Args** — `NEXT_PUBLIC_API_BASE_URL` = URL da API, sem barra final.
4. **Domains** — porta **3000**.
5. **Deploy**.

Três pontos que costumam morder:

- **`NEXT_PUBLIC_API_BASE_URL` é *build arg*, não variável de execução.** O
  valor é gravado dentro do bundle no `next build`. Colocá-la apenas em
  *Environment* não muda nada; trocar o endereço exige um novo **Deploy**.
- **Os arquivos `.env*` não entram na imagem** (ver [`.dockerignore`](.dockerignore)).
  É proposital: um `.env.local` copiado por engano apontaria a produção para o
  backend da máquina de quem construiu.
- **A API precisa liberar CORS** para o domínio onde o app for publicado. A
  chamada sai do navegador do conferente, não do contêiner — o servidor Next só
  entrega os arquivos estáticos.

O contêiner escuta em `0.0.0.0:3000` (`HOSTNAME` e `PORT` já definidos na
imagem) e roda como usuário sem privilégios.

---

## Convenções de código

- Termos de domínio em português (`contagem`, `item`, `estoque`), infraestrutura
  em inglês (`request`, `cache`, `sync`, `storage`).
- Campos vindos da API mantêm o nome original (`snake_case`) e não são
  traduzidos em trânsito; a conversão para o formato interno acontece em um
  único ponto (`toUsuario`, em `app/login/page.tsx`).
- Requisições só através de `lib/api.ts`; IndexedDB só através de
  `lib/database.ts`; `localStorage` só através de `lib/storage.ts`; console só
  através de `createLogger`.
- Regra de negócio mora em `hooks/`; `components/` apenas desenha.
- Todas as cores, sombras e raios vêm dos tokens em `:root` de
  `app/globals.css`. Nenhum hexadecimal solto fora daquele bloco.
- BEM simplificado: `.bloco`, `.bloco__elemento`, `.bloco--modificador`.
- Aspas simples, ponto e vírgula, indentação de 4 espaços.

---

## Solução de problemas

| Sintoma                                   | Verificação                                                                 |
|-------------------------------------------|------------------------------------------------------------------------------|
| "Falha de conexão com o servidor"         | `NEXT_PUBLIC_API_BASE_URL` e se a API responde no endereço configurado.      |
| Endereço da API não mudou                 | Variável `NEXT_PUBLIC_` é embutida no build; refaça o `next build` (no EasyPanel, um novo **Deploy**). |
| Contêiner sobe mas não responde           | `HOSTNAME` precisa ser `0.0.0.0`; já vem definido na imagem.                |
| "blocked by CORS policy" no console       | A API precisa liberar o domínio de publicação — a chamada sai do navegador. |
| Alterações publicadas não aparecem        | `CACHE_VERSION` não foi incrementada; force a atualização do Service Worker. |
| Selo laranja com pendências que não somem | O servidor está recusando os logs. Ver `lastError` na tabela `logs`.         |
| Contagem antiga reaparece preenchida      | A conclusão anterior falhou antes de limpar os logs; refaça a conclusão.     |
| Ícones aparecem como texto                | A fonte Material Icons não carregou (rede bloqueada até fonts.googleapis.com). |

Para inspecionar os dados locais: DevTools → *Application* → *IndexedDB* →
`ContagemAppDB` (tabelas `logs` e `app_cache`).
