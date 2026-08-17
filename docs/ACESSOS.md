# Acessos e transferência

> **Este documento não contém segredo nenhum.** Ele diz *onde* as coisas
> estão, *quem* controla, e *como* recuperar ou transferir. Os valores em
> si vivem nos lugares indicados.

Se você está lendo isto para assumir o projeto: comece pela seção
[Assumindo o projeto](#assumindo-o-projeto), no fim.

## Contas e serviços

| Serviço | Para quê | Dono atual | Custo |
| --- | --- | --- | --- |
| **Cloudflare** | R2 (fotos), Pages (site), Tunnel (acesso à API), DNS | Reginaldo | grátis no uso atual |
| **Hetzner Cloud** | servidor `lixo-na-rua`, CX23 em Helsinki | Reginaldo | ~US$ 7/mês |
| **Expo (EAS)** | build do app, **guarda o keystore** | conta `stenentereis` | grátis, com fila |
| **GitHub** | repositório `stenentereis-lab/lixo-na-rua` | Reginaldo | grátis |
| **Google Cloud** | chave do Maps SDK for Android | projeto "My First Project" | crédito de teste |

Domínio `brconsultorias.com` — registrado fora da Cloudflare, que faz só o
DNS. O projeto usa três subdomínios; o site principal do domínio é outra
coisa e **não deve ser tocado**.

## Onde estão os segredos

| Segredo | Onde vive | Se perder |
| --- | --- | --- |
| `JWT_SECRET` | `/home/lixo/lixo-na-rua/.env.prod` no servidor | gere outro; todos os usuários precisam fazer login de novo |
| Senha do Postgres | mesmo arquivo | recuperável: está no `.env.prod` e no container |
| Credenciais do R2 | mesmo arquivo | crie token novo no painel da Cloudflare |
| Token do Tunnel | mesmo arquivo | crie túnel novo; muda a configuração de hostname |
| Chave do Google Maps | `mobile/app.json`, versionada | crie outra e restrinja ao pacote + SHA-1 |
| **Keystore do Android** | **conta Expo** | 🔴 **irrecuperável** — ver abaixo |
| Chave SSH local | `~/.ssh/id_ed25519` no PC do Reginaldo, com passphrase | em 17/08/2026 o servidor atual não aceitou essa chave; autorização pendente |
| Senha de root para o console | redefinível no painel da Hetzner | serve como acesso de recuperação pelo console web; não habilitar login SSH por senha |

O `.env.prod` **não** está no repositório, de propósito. Ele existe em um
lugar só: dentro do servidor. Vale ter uma cópia num gerenciador de senhas.

## 🔴 O keystore é o único item sem volta

O keystore assina o app Android. O Google identifica atualizações pela
assinatura — não pelo nome.

**Se ele for perdido, nunca mais é possível publicar atualização deste
app.** Nem pelo dono original. A única saída seria publicar um app novo,
com outro nome de pacote, e pedir para todos reinstalarem, perdendo as
avaliações e a base instalada.

Ele está na conta Expo `stenentereis`. Exporte e guarde:

```bash
cd mobile
eas credentials
# Android → production → Keystore → Download
```

Guarde o arquivo `.jks` e a senha em local seguro e com cópia — cofre de
senhas, ou um backup criptografado que não dependa de uma conta só.

Faça isso **antes** de precisar. Perda de acesso à conta Expo, por qualquer
motivo, leva o keystore junto.

## Contas com poder no sistema

Papéis ficam no banco, não em arquivo:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod \
  exec postgres psql -U lixo_app -d lixo_na_rua -c "SELECT email, role FROM users WHERE role <> 'user';"
```

Para promover alguém:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod \
  exec backend npm run set-role -- pessoa@exemplo.com moderator
```

`moderator` muda status de denúncias. `admin` faz isso e remove qualquer
uma. Ver [API.md](API.md#papéis-de-usuário).

## Riscos de concentração

Hoje **uma pessoa controla tudo**. Se ficar indisponível, o projeto para —
não por falta de documentação, mas por falta de acesso.

Mitigações, da mais barata para a mais trabalhosa:

1. **Exportar o keystore** e guardar fora da conta Expo. É o item sem volta.
2. **Cópia do `.env.prod`** num gerenciador de senhas compartilhado.
3. **Segunda chave SSH** autorizada no servidor, de outra pessoa de
   confiança:
   ```bash
   # no servidor, como root
   echo "ssh-ed25519 AAAA... pessoa" >> /home/lixo/.ssh/authorized_keys
   ```
4. **Segundo administrador** nas contas Cloudflare, Hetzner e Expo. Todas
   permitem convidar outro usuário.
5. **Mais de um `admin`** no sistema, para a moderação não parar.

Nada disso é urgente hoje, com duas contas de teste. Passa a ser no dia em
que houver denúncias de cidadãos reais esperando resposta.

## Procedimentos de recuperação

### Perdi o acesso ao servidor (chave SSH ou passphrase)

Quando o servidor é criado com uma chave SSH, a Hetzner não envia senha de
`root`. A senha pode ser criada ou redefinida no painel para uso no console web:

1. **console.hetzner.cloud** → servidor `lixo-na-rua`
2. **Rescue** → seção **Root Password** → **Reset Root Password**
3. Copie a senha exibida e guarde-a no gerenciador de senhas
4. Volte a **Overview** e abra o botão **`>_`** no canto superior direito
5. Entre no console com usuário `root` e a senha gerada — a senha não aparece
   enquanto é digitada
6. Adicione uma chave pública nova em `/home/lixo/.ssh/authorized_keys`
7. Confirme o acesso com `ssh lixo@89.167.52.78` antes de fechar o console

Não é necessário ativar **Enable rescue & power cycle** para apenas redefinir a
senha. Não habilite `PasswordAuthentication` nem `PermitRootLogin yes` no SSH:
a senha de `root` deve permanecer como caminho de recuperação pelo console da
Hetzner, enquanto o acesso remoto diário continua usando chave.

Se a redefinição e o console não resolverem, aí sim use o modo Rescue para
montar o disco e corrigir `authorized_keys`. Esse procedimento reinicia o
servidor e deve ser tratado como manutenção planejada.

Enquanto isso o app continua funcionando: os containers têm
`restart: unless-stopped` e não dependem de ninguém estar conectado.

### Perdi o acesso à conta Cloudflare

Mais grave: site, fotos e o túnel da API dependem dela. O site voltaria
rápido em outro provedor de hospedagem estática, e a API poderia ser
exposta com um proxy reverso no próprio servidor (ver DECISOES #020).

As **fotos no R2 não teriam cópia**. Considere um backup periódico do
bucket se o acervo passar a ter valor.

### O servidor morreu

O banco tem backup diário em `/home/lixo/backups` — que fica **no próprio
servidor**. Se ele for perdido por completo, os backups vão junto.

Copie os backups para fora periodicamente. Reconstruir o resto é rápido:
o [DEPLOY.md](DEPLOY.md) leva de uma máquina vazia ao ar novamente.

## Assumindo o projeto

Na ordem:

1. **Leia** [docs/README.md](README.md) — o que está no ar e o que está pendente
2. **Rode local** seguindo [SETUP.md](SETUP.md)
3. **Entenda as escolhas** em [DECISOES.md](DECISOES.md) antes de desfazer alguma
4. **Consiga os acessos** desta lista, um por um, e confirme cada um
5. **Exporte o keystore** e guarde fora da conta Expo
6. **Teste a restauração do backup** num servidor descartável — nunca foi feita
7. **Só então** mexa em produção

O passo 6 é o que ninguém faz e todo mundo se arrepende. Backup que nunca
foi restaurado é esperança, não backup.

## Manutenção deste documento

Atualize quando: mudar de provedor, adicionar pessoa com acesso, criar
credencial nova, ou quando alguém sair do projeto — **revogando o acesso
dessa pessoa**, o que é fácil de esquecer.

Última atualização: 17/08/2026.
