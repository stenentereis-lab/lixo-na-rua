# Como contribuir

## Fluxo diário

```powershell
# começo do dia
git pull origin main

# trabalhar…
git add .
git commit -m "feat: adiciona endpoint de login"
git push origin main
```

## Mensagens de commit

Formato: `tipo: descrição no imperativo`

| Tipo       | Uso                                       |
| ---------- | ----------------------------------------- |
| `feat`     | funcionalidade nova                       |
| `fix`      | correção de bug                           |
| `docs`     | só documentação                           |
| `refactor` | muda o código sem mudar o comportamento   |
| `test`     | adiciona ou corrige testes                |
| `chore`    | build, dependências, configuração         |

```bash
# ruim
git commit -m "update"
git commit -m "correções"

# bom
git commit -m "fix: trata token expirado no middleware de auth"

# bom, com corpo explicando o porquê
git commit -m "feat: adiciona autenticacao JWT

- POST /auth/register e /auth/login
- hash de senha com bcrypt (10 rounds)
- middleware de verificacao de token
- mesma mensagem de erro para email inexistente e senha errada,
  para nao revelar quais emails estao cadastrados"
```

A regra: a mensagem explica **por que**, o diff já mostra o quê.

## Antes de dar push

```
[ ] O código roda (testado localmente, não só "deve funcionar")
[ ] Funções não óbvias têm JSDoc
[ ] Endpoint novo ou alterado → docs/API.md atualizado
[ ] Decisão técnica relevante → docs/DECISOES.md atualizado
[ ] Sem segredo commitado (.env está no .gitignore — confira)
[ ] Sem TODO/FIXME sem contexto
```

## Documentação junto com o código

Documentação atualizada em commit separado atrasa e é esquecida. Se o commit
muda o comportamento da API, ele inclui a mudança no `docs/API.md`.

| Mudança                      | Atualize                              |
| ---------------------------- | ------------------------------------- |
| Endpoint novo ou alterado    | `docs/API.md`                         |
| Porta, variável de ambiente  | `README.md` + `docs/SETUP.md`         |
| Escolha de biblioteca/stack  | `docs/DECISOES.md`                    |
| Tabela ou coluna nova        | `docs/ARQUITETURA.md`                 |
| Erro novo e a solução        | seção "Problemas conhecidos" do SETUP |

## Padrão de código

### JSDoc em funções não triviais

```javascript
/**
 * Calcula a distância entre dois pontos geográficos (fórmula de Haversine).
 *
 * @param {number} lat1 - Latitude do ponto 1
 * @param {number} lng1 - Longitude do ponto 1
 * @param {number} lat2 - Latitude do ponto 2
 * @param {number} lng2 - Longitude do ponto 2
 * @returns {number} Distância em metros
 *
 * @example
 * calculateDistance(-15.7942, -48.0192, -15.7943, -48.0193); // ~15
 */
function calculateDistance(lat1, lng1, lat2, lng2) { ... }
```

Getters e handlers óbvios não precisam. Documente o que surpreende: unidades,
efeitos colaterais, casos de borda.

### Rotas do Express

```javascript
/**
 * POST /auth/register
 * Cria uma conta e devolve o token de acesso.
 *
 * @body   {string} email
 * @body   {string} password - mínimo 8 caracteres
 * @body   {string} nome
 * @returns 201 { user, token } | 400 validação
 */
router.post('/register', async (req, res) => { ... });
```

### Nomes

- Código, nomes de variáveis e commits: **inglês**
- Comentários, documentação e textos de interface: **português**
- Arquivos com JSX no web: extensão **`.jsx`** (exigência do Vite)

## Segurança

- `.env` **nunca** vai para o repositório. Ao adicionar uma variável, documente
  o nome em `docs/SETUP.md` — nunca o valor.
- Senha sempre com hash bcrypt, nunca em texto puro, nunca no log.
- `JWT_SECRET` de desenvolvimento não vai para produção.
- Toda entrada de usuário é validada no servidor. Validação no cliente é
  conveniência, não segurança.
- Queries sempre parametrizadas (`$1`, `$2`), nunca concatenando string.

## Testes

```powershell
cd C:\lixo-na-rua\backend
npm test
```

Jest e Supertest já estão instalados; `backend/tests/` ainda está vazia. Ao
escrever o primeiro endpoint, escreva também o teste do caminho feliz e de pelo
menos um caso de erro.

## Quando travar

1. Leia a mensagem de erro inteira — a causa costuma estar na primeira linha,
   não na última.
2. Confira "Problemas conhecidos" em [SETUP.md](SETUP.md).
3. Confirme o básico: está na pasta certa (`pwd`)? Rodou `npm install`? O
   Docker está de pé?
4. Pergunte no grupo com a mensagem de erro **completa** e o comando que a
   gerou.
