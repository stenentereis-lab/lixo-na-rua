/**
 * Paleta e espaçamentos compartilhados.
 *
 * As cores vêm da identidade visual (lixo_na_rua.png). Atenção ao usar:
 * o verde vivo da marca (#7CAF2E) tem contraste 2,6 com texto branco e
 * **reprova** no critério AA de acessibilidade. Por isso ele fica só em
 * elementos decorativos; ações e textos usam o verde fechado (#3D7A16,
 * contraste 5,3) ou o verde escuro (#14532D, contraste 9,1).
 */
export const cores = {
  /** Botões e links. Contraste 5,3 com branco — passa em AA. */
  primaria: '#3d7a16',
  primariaEscura: '#2f5f11',
  /** Verde vivo da marca. Só decorativo: reprova com texto branco. */
  marca: '#7caf2e',

  fundo: '#14532d',
  fundoClaro: '#f8faf7',
  cartao: '#ffffff',

  texto: '#14532d',
  textoSuave: '#5b6b5a',
  textoClaro: '#f8faf7',

  borda: '#cbd5c8',

  erro: '#dc2626',
  erroFundo: '#fef2f2',
  sucesso: '#16a34a',
  alerta: '#d97706',
};

export const espaco = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const raio = {
  sm: 8,
  md: 12,
  lg: 16,
};

/** Rótulos das categorias, na ordem em que aparecem na interface. */
export const CATEGORIAS = [
  { valor: 'trash', rotulo: 'Lixo' },
  { valor: 'debris', rotulo: 'Entulho' },
  { valor: 'sewage', rotulo: 'Esgoto' },
  { valor: 'other', rotulo: 'Outro' },
];
