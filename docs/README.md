# Documentação — Lixo na Rua

| Documento                            | Para quê                                                       |
| ------------------------------------ | -------------------------------------------------------------- |
| [SETUP.md](SETUP.md)                 | Subir o ambiente numa máquina nova + problemas conhecidos       |
| [ARQUITETURA.md](ARQUITETURA.md)     | Como o sistema é organizado e o modelo de dados                 |
| [API.md](API.md)                     | Contrato dos endpoints (o que existe e o que está planejado)    |
| [DEPLOY.md](DEPLOY.md)               | Publicar, atualizar e restaurar backup                          |
| [MARCA.md](MARCA.md)                 | Paleta, ícones e regras de uso da identidade visual             |
| [DECISOES.md](DECISOES.md)           | Por que a stack é essa — decisões e seus custos                 |
| [CONTRIBUINDO.md](CONTRIBUINDO.md)   | Padrões de commit, código e segurança                           |

O [README da raiz](../README.md) tem o resumo rápido: portas, comandos e
verificação.

## Por onde começar

**Primeiro dia no projeto** → [SETUP.md](SETUP.md), depois
[ARQUITETURA.md](ARQUITETURA.md).

**Vai escrever código** → [CONTRIBUINDO.md](CONTRIBUINDO.md) e a seção
correspondente da [API.md](API.md).

**Vai mexer em produção** → [DEPLOY.md](DEPLOY.md).

**Quer entender uma escolha estranha** → [DECISOES.md](DECISOES.md).

## Estado atual

**No ar desde 16/08/2026.**

| Peça  | Endereço                            | Onde roda                  |
| ----- | ----------------------------------- | -------------------------- |
| Site  | lixonarua.brconsultorias.com        | Cloudflare Pages           |
| API   | api-lixo.brconsultorias.com         | VPS Hetzner CX23, Helsinki |
| Fotos | fotos-lixo.brconsultorias.com       | Cloudflare R2              |

O ciclo completo funciona e foi exercitado em produção: cadastro, captura
de foto com GPS pelo app instalado, envio para o R2, mapa público com
filtros e estatísticas, e moderação com trilha de auditoria.

134 testes unitários mais 14 de integração contra PostGIS real. Backup do
banco automatizado às 3h.

### Pendências conhecidas

| Item                          | Onde                        |
| ----------------------------- | --------------------------- |
| App não está na Play Store    | build gerada, não publicada |
| Restauração de backup nunca testada | DEPLOY.md              |
| Rate limit em memória         | DECISOES #008               |
| Fotos antigas em disco local não migradas | DECISOES #018   |

## O que a suíte de testes não pega

Vale registrar, porque orientou o trabalho deste projeto. Os defeitos que
chegaram ao usuário em produção foram encontrados **usando o app de
verdade**, não pela suíte:

- `fetch` sem tempo limite travava o app quando o servidor não respondia
- tempo limite curto demais para upload de foto em rede móvel
- `<account-id>` não substituído derrubava só o upload
- URL da foto montada errada com armazenamento no R2
- controles do mapa embaixo da barra de status do aparelho

Nenhum apareceria em teste automatizado, onde o servidor sempre responde
rápido e não existe recorte de tela. Teste automatizado impede regressão;
uso real encontra o que quebra na mão de quem usa. São coisas diferentes.

Última atualização: 17/08/2026.
