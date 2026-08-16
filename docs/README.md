# Documentação — Lixo na Rua

| Documento                            | Para quê                                                       |
| ------------------------------------ | -------------------------------------------------------------- |
| [SETUP.md](SETUP.md)                 | Subir o ambiente numa máquina nova + problemas conhecidos       |
| [ARQUITETURA.md](ARQUITETURA.md)     | Como o sistema é organizado e o modelo de dados                 |
| [API.md](API.md)                     | Contrato dos endpoints (o que existe e o que está planejado)    |
| [DEPLOY.md](DEPLOY.md)               | Publicar em produção + checklist antes de ir ao ar              |
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

**Vai publicar** → [DEPLOY.md](DEPLOY.md), começando pelo checklist.

**Quer entender uma escolha estranha** → [DECISOES.md](DECISOES.md).

## Estado atual

Fases 1 a 3 concluídas e verificadas. O produto faz o ciclo completo:
cadastro, captura de foto com GPS no celular, mapa público com filtros e
estatísticas, e moderação com trilha de auditoria.

119 testes unitários mais 14 de integração contra PostGIS real.

Infraestrutura de produção pronta (Docker, CI, armazenamento em S3), mas
ainda **não publicada**. Falta escolher o provedor de storage e o servidor.

Última atualização: 16/08/2026.
