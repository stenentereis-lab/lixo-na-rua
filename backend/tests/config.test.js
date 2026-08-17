/**
 * Testes da validação de configuração.
 *
 * O objetivo aqui é falhar cedo: erro de configuração deve derrubar o
 * processo no boot, quando quem está olhando é o operador, e não no
 * primeiro upload de um cidadão na rua.
 */

/** Carrega config.js do zero com o ambiente informado. */
function carregarConfig(env) {
  jest.resetModules();
  const original = process.env;
  process.env = { ...original, ...env };
  try {
    return require('../src/config');
  } finally {
    process.env = original;
  }
}

const S3_VALIDO = {
  NODE_ENV: 'test',
  JWT_SECRET: 'segredo_de_teste',
  STORAGE_DRIVER: 's3',
  S3_BUCKET: 'bucket',
  S3_ACCESS_KEY_ID: 'chave',
  S3_SECRET_ACCESS_KEY: 'segredo',
  S3_ENDPOINT: 'https://abc123.r2.cloudflarestorage.com',
};

describe('config — driver local', () => {
  it('sobe sem nenhuma variável de S3', () => {
    const c = carregarConfig({
      NODE_ENV: 'test',
      JWT_SECRET: 'x',
      STORAGE_DRIVER: 'local',
    });
    expect(c.storage.driver).toBe('local');
  });
});

describe('config — driver s3', () => {
  it('aceita configuração completa e válida', () => {
    const c = carregarConfig(S3_VALIDO);
    expect(c.storage.driver).toBe('s3');
    expect(c.s3.bucket).toBe('bucket');
  });

  it('recusa quando falta credencial', () => {
    expect(() =>
      carregarConfig({ ...S3_VALIDO, S3_SECRET_ACCESS_KEY: '' })
    ).toThrow(/S3_SECRET_ACCESS_KEY/);
  });

  it('recusa valor de exemplo não substituído', () => {
    // Aconteceu em produção: o .env.prod ficou com <account-id> literal.
    // O backend subia normalmente e só quebrava no primeiro upload, com
    // erro 500 genérico.
    expect(() =>
      carregarConfig({
        ...S3_VALIDO,
        S3_ENDPOINT: 'https://<account-id>.r2.cloudflarestorage.com',
      })
    ).toThrow(/exemplo não substituídos/i);
  });

  it('recusa endpoint que não é URL', () => {
    expect(() =>
      carregarConfig({ ...S3_VALIDO, S3_ENDPOINT: 'nao-e-url' })
    ).toThrow(/S3_ENDPOINT/);
  });

  it('recusa URL pública inválida', () => {
    expect(() =>
      carregarConfig({ ...S3_VALIDO, S3_PUBLIC_URL: 'fotos.exemplo' })
    ).toThrow(/S3_PUBLIC_URL/);
  });

  it('aceita endpoint vazio (AWS S3 padrão)', () => {
    const c = carregarConfig({ ...S3_VALIDO, S3_ENDPOINT: '' });
    expect(c.s3.endpoint).toBeFalsy();
  });
});

describe('config — JWT', () => {
  it('recusa subir sem JWT_SECRET', () => {
    expect(() =>
      carregarConfig({ NODE_ENV: 'test', JWT_SECRET: '', STORAGE_DRIVER: 'local' })
    ).toThrow(/JWT_SECRET/);
  });

  it('recusa o segredo de desenvolvimento em produção', () => {
    expect(() =>
      carregarConfig({
        NODE_ENV: 'production',
        JWT_SECRET: 'dev_secret_change_in_prod_12345',
        STORAGE_DRIVER: 'local',
      })
    ).toThrow(/desenvolvimento/i);
  });
});
