# Setup do ambiente

Guia para deixar o projeto rodando numa máquina nova. Focado em **Windows +
PowerShell**, que é onde o time está.

## 1. Pré-requisitos

| Ferramenta     | Versão testada | Onde obter                                  |
| -------------- | -------------- | ------------------------------------------- |
| Node.js        | v24.19.0       | https://nodejs.org (LTS serve)              |
| Docker Desktop | v4.86 / 29.7.2 | https://www.docker.com/products/docker-desktop |
| Git            | qualquer       | https://git-scm.com                         |
| WSL 2          | 2.7.11         | `wsl --install` (PowerShell **admin**)      |

### WSL é obrigatório no Windows

O Docker Desktop usa WSL 2 como engine. Sem ele o Docker abre e trava em
*"Starting the Docker Engine..."* ou mostra **"WSL not installed"**.

```powershell
# PowerShell como Administrador
wsl --install
```

Reinicie o computador ao terminar. Na primeira execução o Ubuntu pede um usuário
e senha — pode deixar a senha em branco (Enter duas vezes) e responder `n` para
a coleta de métricas.

### Depois de instalar o Node

O `npm` só aparece no PATH depois de **reabrir o PowerShell**. Se der
`npm não é reconhecido`, feche e abra o terminal.

## 2. Clonar

```powershell
cd C:\
git clone https://github.com/stenentereis-lab/lixo-na-rua.git
cd lixo-na-rua
```

## 3. Instalar dependências

Um comando por vez — o PowerShell 5.1 **não aceita `&&`** entre comandos.

```powershell
cd C:\lixo-na-rua\backend
npm install

cd C:\lixo-na-rua\web
npm install

cd C:\lixo-na-rua\mobile
npm install --legacy-peer-deps
```

> O `--legacy-peer-deps` no mobile é necessário: `react-native-maps` declara
> peer deps de React incompatíveis com a versão do Expo. É um conflito de
> declaração, não de runtime.

## 4. Subir os serviços

**A ordem importa.** O backend testa o banco só no boot, então o Postgres
precisa vir primeiro.

Abra o **Docker Desktop** e espere o engine ficar pronto. Depois, um terminal
para cada serviço:

### Terminal 1 — Banco

```powershell
cd C:\lixo-na-rua
docker compose up -d postgres
docker compose ps          # confirmar: Up (healthy)
```

### Terminal 2 — Backend

Na primeira vez, crie as tabelas:

```powershell
cd C:\lixo-na-rua\backend
npm run migrate
```

```
✅ aplicada:    001_init.sql

1 migration(s) aplicada(s).
```

O comando é seguro de repetir: migrations já aplicadas são puladas.

```powershell
npm run dev
```

Esperado:

```
✅ Server running on http://localhost:3000
✅ Database connected
```

### Terminal 3 — Web

```powershell
cd C:\lixo-na-rua\web
npm start
```

Abre sozinho em http://localhost:3001.

### Terminal 4 — Mobile

```powershell
cd C:\lixo-na-rua\mobile
npx expo start
```

Escaneie o QR code com o app **Expo Go** (celular e PC no mesmo Wi-Fi).

O app descobre o IP do seu PC sozinho — não é preciso configurar endereço. A
tela de login mostra no rodapé qual URL foi detectada, o que ajuda no
diagnóstico se algo não conectar.

#### Libere a porta 3000 no firewall

Este é o tropeço mais provável: o Windows bloqueia conexões vindas da rede
local por padrão, então o celular não alcança o backend mesmo com tudo
rodando. No **PowerShell como administrador**, uma vez só:

```powershell
New-NetFirewallRule -DisplayName "Lixo na Rua - backend" `
  -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

Sintoma de firewall bloqueando: o app mostra
*"Não consegui falar com o servidor em http://192.168.x.x:3000"*, mas
`curl http://localhost:3000/health` funciona no PC.

## 5. Verificar

```powershell
curl http://localhost:3000/health
# {"status":"OK","database":"connected",...}
```

Se vier `"database":"unavailable"` com status 503, a API está no ar mas o
Postgres não responde.

Rode a suíte de testes — ela não precisa de Docker nem de banco:

```powershell
cd C:\lixo-na-rua\backend
npm test
# Tests: 27 passed
```

Por fim, abra http://localhost:3001, crie uma conta e entre. A área autenticada
mostra o status dos três serviços.

## Problemas conhecidos

### `docker : não é reconhecido`

Docker Desktop não está aberto ou não terminou de subir. Abra pelo Menu Iniciar
e espere o ícone da baleia parar de animar.

Para não repetir a cada reinício: Docker Desktop → Settings → **Start Docker
Desktop when you sign in**.

### `failed to connect to the docker API at npipe:...dockerDesktopLinuxEngine`

Mesma causa: o engine não está rodando ainda.

### `Database error` no backend, mesmo com o container de pé

O backend subiu antes do Postgres. No terminal do backend digite `rs` + Enter
(o nodemon reinicia o processo).

### `relation "users" does not exist` ou `relation "complaints" does not exist`

Faltou rodar as migrations:

```powershell
cd C:\lixo-na-rua\backend
npm run migrate
```

### Metro mostra `exp://127.0.0.1:8081` e o QR code não abre nada

O Expo não detectou o IP da sua rede, e `127.0.0.1` é o próprio PC — o celular
nunca vai alcançar esse endereço.

Force o modo LAN:

```powershell
npx expo start --lan
```

Deve passar a mostrar `exp://192.168.x.x:8081`. Se continuar em `127.0.0.1`:

```powershell
# descubra seu IP
ipconfig    # procure "Endereço IPv4" do adaptador Wi-Fi

# e informe ao Expo
$env:REACT_NATIVE_PACKAGER_HOSTNAME = "192.168.0.10"   # troque pelo seu
npx expo start --lan
```

Última alternativa, quando a rede isola os aparelhos (Wi-Fi corporativo ou de
visitantes):

```powershell
npx expo start --tunnel
```

O túnel resolve o carregamento do app, **mas não o acesso ao backend** — o
endereço vira `.exp.direct`, que não serve para achar sua máquina. Nesse caso
defina o IP manualmente em `mobile/app.json`:

```json
{
  "expo": {
    "extra": { "apiUrl": "http://192.168.0.10:3000" }
  }
}
```

A tela de login avisa em amarelo quando o endereço detectado não parece de rede
local, antes de você tentar entrar e receber erro sem explicação.

### `Project is incompatible with this version of Expo Go`

O Expo Go das lojas suporta só o SDK mais recente. Se a mensagem disser que o
Expo Go é de um SDK mais novo que o do projeto, o projeto precisa ser
atualizado — não adianta insistir no QR code.

```powershell
cd C:\lixo-na-rua\mobile
Remove-Item -Recurse -Force node_modules
npm install
npx expo install --fix
```

O projeto está no **SDK 54**. Ao migrar de SDK, confira a API do `expo-camera`
e do `expo-location`: elas mudam entre versões. Ver `docs/DECISOES.md` #013.

### Avisos de versão ao iniciar o Expo

```
expo-location@16.5.5 - expected version: ~16.1.0
react-native@0.72.6 - expected version: 0.72.10
```

São incompatibilidades reais com o SDK 49. Corrija com:

```powershell
npx expo install --fix
```

### App mobile não conecta no backend

Na ordem:

1. O backend está rodando? `curl http://localhost:3000/health` no PC.
2. A porta 3000 está liberada no firewall? Veja a seção do mobile acima.
3. Celular e PC estão na **mesma rede** Wi-Fi? Rede de visitantes costuma
   isolar os aparelhos entre si.
4. A URL no rodapé da tela de login está com o IP do PC (`192.168...`) e não
   `localhost`?

### Mapa do app aparece cinza e vazio

No **Expo Go** o mapa funciona sem configuração. Se estiver cinza:

1. Confirme que deu permissão de localização ao app
2. Confirme que o backend responde — o mapa busca em `/map/nearby`
3. Se for uma **build própria** para Android, falta a chave do Google Maps
   — ver [DEPLOY.md](DEPLOY.md#chave-do-google-maps-android)

### Foto não aparece na lista

As imagens ficam em `backend/uploads/`. Confirme que o arquivo está lá e que
`GET http://localhost:3000/uploads/<nome>` abre no navegador.

### `JWT_SECRET não definido`

Falta o `backend/.env`:

```powershell
copy backend\.env.example backend\.env
```

### `'nodemon' / 'vite' não é reconhecido`

Faltou `npm install` naquela pasta.

### `EPERM: operation not permitted, mkdir 'C:\WINDOWS\system32\node_modules'`

O terminal estava em `C:\WINDOWS\system32` em vez da pasta do projeto. Sempre
rode `cd` antes do `npm`. Confira com `pwd`.

### `O token '&&' não é um separador de instruções válido`

PowerShell 5.1. Rode um comando por linha.

### `curl` no PowerShell não funciona como esperado

No PowerShell, `curl` é **apelido do `Invoke-WebRequest`**, que tem sintaxe
diferente. Comandos com `-H` e `-d` falham com
*"Não é possível associar o parâmetro 'Headers'"*.

**Para POST com corpo JSON, use `Invoke-RestMethod`** — é o caminho que
funciona sem dor de cabeça:

```powershell
Invoke-RestMethod -Uri https://api-lixo.brconsultorias.com/auth/register `
  -Method Post -ContentType "application/json" `
  -Body '{"email":"a@b.com","password":"senha-forte-123","nome":"Teste"}'
```

Note as **aspas simples** no `-Body`: elas impedem o PowerShell de
interpretar o conteúdo. Com aspas duplas e escapes (`\"`), o PowerShell
mastiga a string antes de repassar, e a API recebe JSON quebrado
(`Expected property name or '}' in JSON at position 1`).

`curl.exe` até existe no Windows 10+, mas o escape de aspas no PowerShell é
uma fonte constante de erro. Evite para POST.

Para GET simples, `curl` funciona normalmente:

```powershell
curl http://localhost:3000/health
```

> Erro do `Invoke-RestMethod` com status 4xx aparece como exceção vermelha,
> não como resposta. `{"error":"Este e-mail já está cadastrado"}` dentro de
> um `Invoke-RestMethod :` é a API respondendo corretamente — não é falha do
> comando.

### Conexão SSH cai sozinha

Sintoma: `client_loop: send disconnect: Connection reset`, geralmente depois
de um comando demorado como `docker compose build`. O comando seguinte acaba
rodando no PowerShell do seu PC, que não entende sintaxe do Linux.

Roteadores e provedores encerram conexões ociosas. Configure o SSH para
mandar um sinal periódico — uma vez só, no **seu PC**:

```powershell
Add-Content -Path $env:USERPROFILE\.ssh\config -Value "Host *"
Add-Content -Path $env:USERPROFILE\.ssh\config -Value "  ServerAliveInterval 60"
Add-Content -Path $env:USERPROFILE\.ssh\config -Value "  ServerAliveCountMax 5"
```

**Como saber onde você está**, antes de colar qualquer comando:

| Prompt                  | Onde        | Aceita           |
| ----------------------- | ----------- | ---------------- |
| `PS C:\Users\user>`     | seu PC      | comandos Windows |
| `root@lixo-na-rua:~#`   | servidor    | comandos Linux   |
| `lixo@lixo-na-rua:~$`   | servidor    | comandos Linux   |

### `su` engole o comando seguinte

Colar duas linhas de uma vez depois de `su - lixo` não funciona: o `su` abre
um shell novo e consome a linha seguinte como entrada. O `cd` some, e o
comando seguinte roda na pasta errada.

Depois de `su`, execute **um comando por vez**, esperando o prompt voltar.
Confirme com `pwd` antes de comandos que dependem da pasta.

### Porta ocupada / processo órfão

Sintomas conhecidos:

| Mensagem                                    | Porta | Serviço |
| ------------------------------------------- | ----- | ------- |
| `EADDRINUSE: address already in use :::3000` | 3000  | backend |
| `Port 8081 is being used by another process` | 8081  | Expo    |
| `Port 3001 is in use`                        | 3001  | web     |

Todas têm a mesma causa: um processo de sessão anterior continuou vivo depois
que a janela do terminal foi fechada. Fechar a janela **não** encerra o
processo filho.

O caso mais traiçoeiro é o backend: ele fica no ar, mas com a conexão do banco
perdida (por exemplo, o Docker foi desligado no meio). Requisições ficam
penduradas e o app mostra tempo limite, mesmo com "um backend rodando".

```powershell
# descubra o dono da porta — o PID é a última coluna
netstat -ano | findstr :3000

# derrube
taskkill /PID <numero> /F
```

Para conferir o que está de pé antes de começar:

```powershell
netstat -ano | findstr "LISTENING" | findstr ":3000 :3001 :8081 :5432"
```

**Encerre com Ctrl+C** na janela do serviço, em vez de fechar a janela no X.
Isso evita o problema.

### npm instala versão inexistente (`No matching version found`)

Aconteceu com `jsonwebtoken@^9.1.2`, que não existe. Corrigido para `^9.0.2`.
Se reaparecer com outro pacote:

```powershell
npm cache clean --force
del package-lock.json
npm install
```

## Não faça

Evite criar arquivos de código com `Out-File` no PowerShell 5.1 — ele grava
UTF-8 **com BOM** e corrompe acentos e emojis. Use o VS Code ou outro editor.
