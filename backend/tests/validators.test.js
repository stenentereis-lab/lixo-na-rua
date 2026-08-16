/**
 * Testes das funções de validação.
 *
 * Puros, sem banco e sem HTTP — é onde mora a maior parte das regras de
 * negócio sobre coordenadas.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'segredo_de_teste';

const {
  validateNearby,
  validateBbox,
  validatePagination,
  normalizeEmail,
  toNumber,
  RAIO_MAXIMO,
  RAIO_PADRAO,
} = require('../src/utils/validators');

describe('toNumber', () => {
  it('converte texto numérico', () => {
    expect(toNumber('-15.7942')).toBe(-15.7942);
  });

  it('preserva o zero', () => {
    // Zero é coordenada válida; tratá-lo como ausente seria bug.
    expect(toNumber(0)).toBe(0);
    expect(toNumber('0')).toBe(0);
  });

  it('devolve null para vazio e para texto não numérico', () => {
    expect(toNumber('')).toBeNull();
    expect(toNumber(null)).toBeNull();
    expect(toNumber(undefined)).toBeNull();
    expect(toNumber('perto do mercado')).toBeNull();
  });

  it('devolve null para infinito e NaN', () => {
    expect(toNumber(Infinity)).toBeNull();
    expect(toNumber(NaN)).toBeNull();
  });
});

describe('normalizeEmail', () => {
  it('deixa minúsculo e remove espaços das pontas', () => {
    expect(normalizeEmail('  Maria@Example.COM ')).toBe('maria@example.com');
  });

  it('lida com valor ausente', () => {
    expect(normalizeEmail(undefined)).toBe('');
  });
});

describe('validateNearby', () => {
  it('aceita coordenadas válidas', () => {
    const r = validateNearby({ lat: '-15.7942', lng: '-48.0192' });
    expect(r).toEqual({ lat: -15.7942, lng: -48.0192, radius: RAIO_PADRAO });
  });

  it('aceita a origem (0,0)', () => {
    const r = validateNearby({ lat: 0, lng: 0 });
    expect(r.lat).toBe(0);
    expect(r.lng).toBe(0);
  });

  it('usa o raio padrão quando não informado', () => {
    expect(validateNearby({ lat: 0, lng: 0 }).radius).toBe(RAIO_PADRAO);
  });

  it('exige lat e lng', () => {
    expect(() => validateNearby({})).toThrow(/inválidos/i);

    try {
      validateNearby({});
    } catch (e) {
      expect(e.status).toBe(400);
      expect(Object.keys(e.details).sort()).toEqual(['lat', 'lng']);
    }
  });

  it('recusa latitude fora do intervalo', () => {
    expect(() => validateNearby({ lat: 91, lng: 0 })).toThrow();
    expect(() => validateNearby({ lat: -91, lng: 0 })).toThrow();
  });

  it('recusa longitude fora do intervalo', () => {
    expect(() => validateNearby({ lat: 0, lng: 181 })).toThrow();
  });

  it('recusa raio zero ou negativo', () => {
    expect(() => validateNearby({ lat: 0, lng: 0, radius: 0 })).toThrow();
    expect(() => validateNearby({ lat: 0, lng: 0, radius: -5 })).toThrow();
  });

  it('recusa raio acima do teto', () => {
    // Sem teto, um cliente poderia pedir a tabela inteira.
    try {
      validateNearby({ lat: 0, lng: 0, radius: RAIO_MAXIMO + 1 });
      throw new Error('deveria ter recusado');
    } catch (e) {
      expect(e.status).toBe(400);
      expect(e.details.radius).toMatch(/máximo/i);
    }
  });

  it('aceita exatamente o raio máximo', () => {
    const r = validateNearby({ lat: 0, lng: 0, radius: RAIO_MAXIMO });
    expect(r.radius).toBe(RAIO_MAXIMO);
  });
});

describe('validateBbox', () => {
  it('devolve null quando não informada', () => {
    expect(validateBbox(undefined)).toBeNull();
    expect(validateBbox('')).toBeNull();
  });

  it('interpreta oeste,sul,leste,norte', () => {
    expect(validateBbox('-48.1,-15.9,-48.0,-15.7')).toEqual({
      oeste: -48.1,
      sul: -15.9,
      leste: -48.0,
      norte: -15.7,
    });
  });

  it('recusa quantidade errada de números', () => {
    expect(() => validateBbox('-48.1,-15.9,-48.0')).toThrow(/quatro/i);
  });

  it('recusa valores não numéricos', () => {
    expect(() => validateBbox('a,b,c,d')).toThrow();
  });

  it('recusa sul maior que norte', () => {
    expect(() => validateBbox('-48.1,-15.7,-48.0,-15.9')).toThrow(/sul/i);
  });

  it('recusa coordenadas fora dos limites do globo', () => {
    expect(() => validateBbox('-181,-15.9,-48.0,-15.7')).toThrow();
    expect(() => validateBbox('-48.1,-15.9,-48.0,91')).toThrow();
  });
});

describe('validatePagination', () => {
  it('usa os padrões quando nada é informado', () => {
    expect(validatePagination({})).toEqual({ page: 1, limit: 20, offset: 0 });
  });

  it('calcula o offset a partir da página', () => {
    expect(validatePagination({ page: 3, limit: 10 }).offset).toBe(20);
  });

  it('limita o tamanho da página em 100', () => {
    expect(validatePagination({ limit: 99999 }).limit).toBe(100);
  });

  it('corrige valores absurdos em vez de falhar', () => {
    // Paginação inválida não deve derrubar a requisição.
    expect(validatePagination({ page: -5, limit: 0 })).toEqual({
      page: 1,
      limit: 20,
      offset: 0,
    });
  });
});
