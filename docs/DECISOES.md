# Registro de decisões técnicas

Cada entrada: contexto, decisão, consequências. Ordem cronológica inversa
(mais recente primeiro).

---

## 013 — Mobile no Expo SDK 54

**Data:** 16/08/2026 · **Status:** aceita

### Contexto

O projeto nasceu no SDK 49. Ao abrir no celular, o Expo Go recusou:

```
Project is incompatible with this version of Expo Go
• The installed version of Expo Go is for SDK 54.
• The project you opened uses SDK 49.
```

O Expo Go publicado nas lojas suporta **apenas o SDK mais recente**. Manter o
projeto em 49 exigiria instalar um Expo Go antigo à mão em cada aparelho de
teste — inviável para um time.

### Decisão

Migrar para o SDK 54: React Native 0.81.5, React 19.1.0, React Navigation 7.

### Consequências

**Ganhos** — funciona com o Expo Go da loja, sem instalação manual em cada
celular; recebe correções de segurança.

**Custos** — a API do `expo-camera` mudou:

| SDK 49                                | SDK 54                                     |
| ------------------------------------- | ------------------------------------------ |
| `import { Camera }`                   | `import { CameraView }`                    |
| `Camera.requestCameraPermissionsAsync()` | `useCameraPermissions()`                |
| `<Camera ratio="16:9" />`             | `<CameraView facing="back" />`             |
| permissão como `'granted'` (string)   | objeto `{ granted, canAskAgain, status }`  |

`skipProcessing` também saiu do `takePictureAsync`.

React Navigation subiu de 6 para 7, exigido por `react-native-screens` 4.x —
a v6 pede screens 3.x, incompatível com o SDK 54.

**Regra que fica:** a versão do SDK é ditada pelo Expo Go das lojas, não pela
nossa conveniência. Ao atualizar, verifique a API de `expo-camera` e
`expo-location` antes de assumir que o código continua valendo.

---

## 012 — Coordenada derivada por trigger, não pela aplicação

**Data:** 16/08/2026 · **Status:** aceita

### Contexto

A denúncia precisa de latitude/longitude como números (para devolver na API) e
de um `geometry(Point)` do PostGIS (para as consultas espaciais). Manter os
dois em sincronia na aplicação significa lembrar disso em todo INSERT e UPDATE
— e um dia alguém esquece, deixando a denúncia fora do mapa sem erro visível.

### Decisão

`location_geom` é preenchida por um trigger `BEFORE INSERT OR UPDATE`, a partir
de `latitude` e `longitude`. O mesmo trigger atualiza `updated_at`.

### Consequências

**Ganhos** — impossível gravar denúncia com geometria dessincronizada; a
aplicação não precisa conhecer PostGIS para inserir; qualquer caminho de
escrita (API, script, SQL manual) fica correto.

**Custos** — lógica fora do código da aplicação, num lugar onde quem lê o
JavaScript não a vê. Mitigado com `COMMENT ON COLUMN` na própria migration.
O pg-mem não suporta triggers com PostGIS, então nos testes a coluna nem
existe — ver #009.

---

## 011 — Mobile descobre o IP do backend sozinho

**Data:** 16/08/2026 · **Status:** aceita

### Contexto

No celular, `localhost` é o próprio aparelho, não o PC onde o backend roda. O
caminho comum é o desenvolvedor descobrir o IP da máquina e escrever à mão no
código — que quebra quando o roteador troca o IP, e quebra para cada pessoa
nova no time.

### Decisão

Derivar o endereço do `Constants.expoConfig.hostUri`, que o Expo já preenche
com o IP da máquina do Metro, trocando a porta para 3000.

Permanece possível sobrescrever via `app.json > extra.apiUrl`, para o caso do
backend não estar na mesma máquina.

### Consequências

**Ganhos** — funciona sem configuração, em qualquer rede, para qualquer pessoa
do time.

**Custos** — depende de o Metro e o backend estarem na mesma máquina, que é o
caso em desenvolvimento. Em build de produção `hostUri` não existe: será
necessário definir a URL real via `extra.apiUrl` ou variável de build.

**Efeito colateral útil:** a tela de login mostra a URL detectada no rodapé,
o que transforma "não conecta" em diagnóstico imediato.

---

## 010 — Fotos em disco local no MVP

**Data:** 16/08/2026 · **Status:** aceita, **com prazo de validade**

### Contexto

O `.env` já previa S3, mas sem credenciais. Configurar bucket, IAM e política
antes de existir a primeira denúncia adiaria a funcionalidade central do
produto.

### Decisão

`multer` gravando em `backend/uploads/`, servido por `express.static`. Nome de
arquivo aleatório (UUID), limite de 10 MB, apenas JPEG/PNG/WebP/HEIC.

### Consequências

**Ganhos** — funciona hoje, sem conta em nuvem nem custo; o contrato da API
(`POST /uploads` devolvendo `{ url }`) é o mesmo que o S3 terá, então a troca
não afeta os clientes.

**Custos, e são sérios:**
- Container reiniciado **perde as fotos** — disco de container é efêmero.
- Não funciona com mais de uma instância: o upload cai numa, a leitura vai na outra.
- Sem CDN, o Node serve imagem, o que é desperdício de processo.

**Quando trocar:** antes do primeiro deploy real com usuários. Trocar depois
significa migrar arquivos já enviados.

**Validações que já estão certas e devem ser mantidas na migração:** nome
aleatório (o nome do cliente permitiria sobrescrita e path traversal), limite
de tamanho e allowlist de MIME.

---

## 009 — Testes com banco em memória (pg-mem)

**Data:** 16/08/2026 · **Status:** aceita

### Contexto

Testar as rotas exige banco. As opções eram: subir um Postgres real no CI
(lento, mais uma peça para configurar), mockar o módulo `pg` na mão (não valida
SQL — um `SELECT` com erro de digitação passaria no teste), ou emular.

### Decisão

Usar **pg-mem**, um Postgres em memória que fala o protocolo do `pg`.

O módulo `src/db.js` é substituído via `jest.mock`, e o schema é recriado a
cada execução em `tests/helpers/testDb.js`.

### Consequências

**Ganhos** — a suíte roda com `npm test`, sem Docker e sem Postgres instalado;
27 testes em ~2s; o SQL é validado de verdade, inclusive constraints (o teste
de e-mail duplicado passa pelo `UNIQUE` real).

**Custos** — pg-mem **não implementa PostGIS**. Quando entrarem as queries
espaciais (`ST_DWithin`, `ST_MakePoint`), elas precisarão de teste de
integração contra um Postgres real. Também não cobre `pgcrypto`: registramos
`gen_random_uuid` manualmente no helper.

**Consequência prática:** ao criar a tabela `complaints`, o schema passa a
existir em dois lugares — a migration e o helper de teste. Se divergirem, o
teste mente. Ao alterar a migration, atualize o helper no mesmo commit.

---

## 008 — Rate limit em memória no login

**Data:** 16/08/2026 · **Status:** aceita, com prazo de validade

### Contexto

`/auth/login` sem limite é convite a força bruta. Bibliotecas como
`express-rate-limit` resolvem, mas trariam mais uma dependência para um app
que ainda não tem nem uma instância em produção.

### Decisão

Limitador próprio, ~50 linhas, com contador em memória.
Login: 5 tentativas / 15 min por IP. Cadastro: 10 / hora.

### Consequências

**Ganhos** — proteção real contra força bruta, sem dependência nova; responde
429 com `Retry-After`.

**Custos** — o contador vive na memória do processo. **Com mais de uma
instância da API, o limite se multiplica pelo número de instâncias.** Reiniciar
o processo zera os contadores.

**Quando trocar:** ao subir a segunda instância. O Redis já está no
`docker-compose.yml` justamente para isso.

Nos testes o middleware fica desligado por padrão (`enabled: !config.isTest`),
senão a própria suíte se autobloquearia; ele tem teste dedicado que o liga
explicitamente.

---

## 007 — Lockfiles passam a ser versionados

**Data:** 16/08/2026 · **Status:** aceita

### Contexto

O `.gitignore` inicial listava `package-lock.json` e `yarn.lock`. Isso significa
que cada `npm install` resolvia a árvore de dependências do zero, e cada máquina
podia acabar com versões diferentes das mesmas bibliotecas.

Provavelmente contribuiu para os problemas da primeira semana: o
`jsonwebtoken@^9.1.2` inexistente só apareceu na instalação, e o conflito
`ajv` / `ajv-keywords` do CRA é exatamente o tipo de coisa que um lockfile
travado evita.

### Decisão

Remover os lockfiles do `.gitignore` e versioná-los.

### Consequências

**Ganhos** — instalação reproduzível entre máquinas e no CI; `npm ci` passa a
funcionar (mais rápido e determinístico); atualização de dependência vira uma
mudança visível no diff, sujeita a revisão.

**Custos** — o `package-lock.json` é grande e aparece em muitos diffs. Ao
revisar, olhe o `package.json`; o lock é consequência.

**Regra prática:** aplicações versionam o lockfile. Bibliotecas publicadas no
npm, não.

---

## 006 — Web migrado de Create React App para Vite

**Data:** 15/08/2026 · **Status:** aceita

### Contexto

O web não subia. Três falhas encadeadas:

1. `react-scripts` não constava no `package.json` original, apesar dos scripts
   `start`/`build` o invocarem. Foi instalado avulso, sem lockfile consistente.
2. Com o campo `"proxy": "http://localhost:3000"` presente, o dev server do CRA
   ativa a checagem de host e monta `allowedHosts: [urls.lanUrlForConfig]`.
   Nesta máquina — WSL recém-instalado, várias interfaces virtuais — o IP de LAN
   vinha `undefined`, e o webpack-dev-server rejeitava a config:

   ```
   Invalid options object. Dev Server has been initialized using an options
   object that does not match the API schema.
   - options.allowedHosts[0] should be a non-empty string.
   ```

3. Ao testar `react-scripts build` num ambiente limpo, quebrou de novo com
   `MODULE_NOT_FOUND` em `ajv-keywords` — o conflito clássico `ajv@6` vs `ajv@8`
   na árvore do CRA 5.

### Decisão

Migrar para **Vite 5 + @vitejs/plugin-react**.

O Create React App está descontinuado desde 2025 e não recebe correções. Cada
workaround aplicado (`DANGEROUSLY_DISABLE_HOST_CHECK`, remoção do `proxy`,
limpeza de cache) resolvia um sintoma e revelava outro.

### Consequências

**Ganhos**
- Dev server sobe em ~100ms (era ~60s quando subia).
- Build de produção em ~500ms.
- ~1200 dependências transitivas a menos.
- Sem a classe de erros de config do webpack-dev-server.

**Custos / mudanças**
- `index.html` sai de `public/` e vai para a **raiz** de `web/`, com
  `<script type="module" src="/src/main.jsx">`.
- Entrada renomeada: `src/index.js` → `src/main.jsx`. Componentes com JSX
  precisam da extensão `.jsx`.
- Variáveis de ambiente: prefixo `REACT_APP_` → **`VITE_`**, e o acesso muda de
  `process.env.X` para `import.meta.env.X`.
- Sem o campo `proxy` do `package.json`. O frontend chama a API pela URL
  absoluta em `VITE_API_URL`; o CORS do backend já libera `localhost:3001`.

### Verificação

Build e dev server foram executados num ambiente limpo antes de aplicar:
build 494ms, dev server HTTP 200 servindo `index.html` e `main.jsx`.

---

## 005 — Backend na 3000, web na 3001

**Data:** 15/08/2026 · **Status:** aceita

### Contexto

Ambos tentavam usar a 3000. O segundo a subir falhava ou era realocado
silenciosamente, e o frontend chamava a API no lugar errado.

### Decisão

Backend fixo em 3000 (`backend/.env`), web fixo em 3001
(`server.port` em `web/vite.config.js`). `CORS_ORIGIN` do backend inclui 3001.

### Consequências

Portas previsíveis, sem realocação surpresa. Ao adicionar um serviço novo,
escolha uma porta livre e registre na tabela do README.

---

## 004 — `jsonwebtoken` fixado em ^9.0.2

**Data:** 15/08/2026 · **Status:** aceita

O `package.json` pedia `^9.1.2`, versão que **não existe** no registry, e todo
`npm install` do backend falhava com `ETARGET`. Corrigido para `^9.0.2`, a
última 9.x publicada.

**Lição:** não escrever versões de memória. Confirmar com `npm view <pkg> versions`.

---

## 003 — WSL 2 como pré-requisito no Windows

**Data:** 15/08/2026 · **Status:** aceita

O Docker Desktop no Windows precisa de WSL 2. Sem ele trava em *"Starting the
Docker Engine..."*. Documentado em `docs/SETUP.md` como primeiro passo, antes
mesmo de instalar o Docker.

---

## 002 — React Native + Expo para o mobile

**Data:** 15/08/2026 · **Status:** aceita

### Contexto

Requisito: iOS + Android + web, prazo de 3 meses, com a stack mais acessível
possível.

### Decisão

React Native com **Expo** (managed workflow).

### Consequências

**Ganhos** — uma base de código para as duas plataformas; sem necessidade de Mac
para desenvolver (só para publicar na App Store); teste no dispositivo real via
QR code do Expo Go; `expo-camera` e `expo-location` cobrem os dois requisitos
centrais sem código nativo.

**Custos** — módulos nativos fora do ecossistema Expo exigem *prebuild*; o app
carrega bibliotecas que talvez não sejam todas usadas; conflitos de peer deps
exigem `npm install --legacy-peer-deps`.

---

## 001 — PostgreSQL + PostGIS como banco

**Data:** 15/08/2026 · **Status:** aceita

### Contexto

O produto é essencialmente geográfico: denúncias com coordenadas, busca por
proximidade, mapa de calor, agregação por região.

### Decisão

PostgreSQL 15 com a extensão PostGIS 3.3, via imagem `postgis/postgis:15-3.3`.

### Consequências

**Ganhos** — consultas espaciais nativas (`ST_DWithin`, `ST_Distance`,
`ST_MakePoint`); índice GIST torna a busca por raio eficiente em escala;
dados relacionais e geográficos no mesmo banco, numa transação só.

**Custos** — imagem Docker maior que a do Postgres puro; PostGIS tem curva de
aprendizado; nem todo serviço gerenciado oferece a extensão (verificar antes de
escolher o provedor de produção).

---

## Como registrar uma decisão

Abra uma entrada quando a escolha for difícil de reverter, quando houver
alternativa razoável descartada, ou quando alguém for perguntar "por que isso
está assim?" daqui a três meses.

Formato: contexto (o problema), decisão (o que foi escolhido), consequências
(ganhos **e** custos — decisão sem custo listado geralmente é análise
incompleta).
