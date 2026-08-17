# Nota sobre `api.imagemUrl`

Este projeto não tem suíte de testes no frontend. Enquanto não houver,
fica registrado aqui o comportamento esperado — foi um bug real em
produção e é fácil de reintroduzir.

| Entrada                                           | Saída esperada                    |
| ------------------------------------------------- | --------------------------------- |
| `/uploads/abc.jpg`                                | `<API_URL>/uploads/abc.jpg`       |
| `https://fotos-lixo.../denuncias/abc.jpg`         | inalterada                        |
| `http://exemplo/foto.jpg`                         | inalterada                        |
| `null` ou `""`                                    | `null`                            |

## Por que existe

Os dois drivers de armazenamento devolvem `image_url` em formatos
diferentes:

- **local** → caminho relativo à API (`/uploads/abc.jpg`)
- **S3/R2** → URL absoluta (`https://fotos.../denuncias/abc.jpg`)

O código original concatenava `API_URL + image_url` sempre. Funcionava em
desenvolvimento com disco local, e quebrou na primeira foto real em
produção: virava `https://api-lixo...https://fotos-lixo...`.

O sintoma foi pior que o erro: com `alt=""`, a imagem quebrada fica
invisível. A denúncia aparecia no mapa "sem foto", sem nenhum erro.

Por isso agora o `alt` descreve a imagem e há um `onerror` que registra no
console — falha silenciosa é a mais cara de encontrar.
