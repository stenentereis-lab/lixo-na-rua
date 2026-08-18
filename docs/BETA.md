# Programa comunitário de testes

## Escopo do primeiro ciclo

- 30 a 50 participantes maiores de 18 anos;
- Android, com diversidade de fabricantes e versões;
- 14 a 21 dias de uso;
- ambientes urbanos e rurais;
- dados, contas e fotos totalmente separados da produção.

## Roteiro do participante

1. preencher a inscrição em `/beta` e baixar o APK pelo botão exibido após a confirmação;
2. confirmar que a faixa “VERSÃO DE TESTE” aparece;
3. criar conta e ler os documentos;
4. fotografar um objeto seguro usado apenas para simulação;
5. anotar a margem de GPS exibida e testar em área aberta;
6. conferir foto, ponto do mapa e histórico;
7. repetir em Wi-Fi e, se possível, rede móvel;
8. enviar feedback com aparelho, Android, etapa, resultado esperado e observado.

## Regras de segurança

Não fotografar pessoas, placas, documentos, residências ou situação perigosa. Não
entrar em propriedade privada. Não usar o beta para denúncia real ou emergência.
Vulnerabilidade de segurança deve ser comunicada em particular.

## Operação

- inscrições: página `/beta`, com liberação imediata do APK após o cadastro;
- gestão: aba **Inscrições beta**, visível apenas para contas `admin`;
- dados cadastrais: tabela `beta_signups` do banco principal, separada de usuários e ocorrências;
- suporte e privacidade: `regiolireis@gmail.com`;
- uso do aplicativo beta: banco `lixo_na_rua_beta` e volume de fotos descartáveis;
- produção: recebe somente a inscrição administrativa; contas, fotos e ocorrências de teste permanecem no ambiente beta;
- ao final: exportar feedback anonimizado e eliminar inscrições não necessárias.

## Fluxo administrativo

1. o formulário grava a inscrição com situação `pending`;
2. a confirmação libera o link oficial do APK imediatamente;
3. o administrador acompanha totais, dados do aparelho e data de cadastro no painel;
4. a situação pode ser atualizada para `invited`, `accepted`, `declined` ou `removed`;
5. a lista não é pública e a API exige autenticação com papel `admin`.
