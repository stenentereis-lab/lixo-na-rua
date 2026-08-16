# Identidade visual

Todos os elementos derivam de `lixo_na_rua.png`, a arte original da marca.

## Paleta

| Cor            | Hex       | Contraste com branco | Onde usar                          |
| -------------- | --------- | -------------------- | ---------------------------------- |
| Verde da marca | `#7CAF2E` | 2,6 — **reprova**    | só decoração: fundos, ícones, selos |
| Verde ação     | `#3D7A16` | 5,3 — passa AA       | botões, links, barras              |
| Verde ação escuro | `#2F5F11` | 7,1 — passa AA    | hover de botão                     |
| Verde escuro   | `#14532D` | 9,1 — passa AA       | títulos, texto, fundos escuros     |
| Fundo claro    | `#F8FAF7` | —                    | tela de abertura, cartões          |

> ⚠️ O verde vivo da marca (`#7CAF2E`) tem contraste **2,6** com texto branco.
> O mínimo do critério AA é 4,5 para texto normal. Usá-lo em botão com texto
> branco deixaria o app ilegível para quem tem baixa visão ou está no sol —
> situação comum, já que o app é usado na rua.
>
> Por isso a interface usa `#3D7A16` nas ações e reserva o verde vivo para
> elementos sem texto. Os valores acima foram calculados, não estimados.

As cores de categoria no mapa (vermelho, laranja, roxo, ciano) **não** seguem
a paleta de propósito: precisam ser distinguíveis entre si, e um mapa todo
verde não comunicaria nada.

## Arquivos gerados

| Arquivo                            | Tamanho     | Uso                                  |
| ---------------------------------- | ----------- | ------------------------------------ |
| `mobile/assets/icon.png`           | 1024×1024   | ícone do app (iOS e Android legado)  |
| `mobile/assets/adaptive-icon.png`  | 1024×1024   | ícone adaptativo do Android          |
| `mobile/assets/splash.png`         | 1284×1284   | tela de abertura                     |
| `mobile/assets/logo.png`           | 620×354     | logo escrita, fundo transparente     |
| `web/public/favicon.png`           | 512×512     | favicon e ícone de atalho            |
| `web/public/banner.jpg`            | 760×760     | arte da tela de login                |
| `web/public/logo.png`              | 420×240     | logo no topo do formulário           |

## Por que o ícone não é a arte inteira

A arte original é um banner: logo, tagline, foto e quatro passos ilustrados.
Reduzida a 48×48 — o tamanho real na tela inicial do celular — vira uma
mancha verde ilegível.

O ícone usa só o **pin com a pessoa e a lixeira**, que é o elemento com
silhueta forte o bastante para sobreviver à redução. Foi extraído da arte por
segmentação de cor, com remoção de manchas de compressão.

### Ícone adaptativo do Android

O Android recorta o ícone em círculo, quadrado ou squircle conforme o
fabricante do aparelho. Só os **66% centrais** são garantidos, então o símbolo
no `adaptive-icon.png` é proporcionalmente menor que no `icon.png` — senão
seria cortado em alguns celulares.

## Regenerar os assets

Os arquivos são derivados da arte original. Se ela mudar, regenere em vez de
editar à mão. O procedimento está registrado em `docs/DECISOES.md` #019.

## Uso da arte original

`lixo_na_rua.png` continua servindo para divulgação: loja de aplicativos,
redes sociais e apresentações. Não é adequada para ícone nem para tela de
abertura, pelo motivo acima.
