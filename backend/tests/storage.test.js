/**
 * Testes do driver de armazenamento local.
 *
 * O driver S3 não é testado aqui: exigiria credenciais reais ou um MinIO
 * de pé. O que garante que os dois são intercambiáveis é o contrato —
 * ambos exportam `salvar` e `remover` com a mesma assinatura, e este
 * arquivo verifica esse contrato no driver local.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'segredo_de_teste';
process.env.STORAGE_DRIVER = 'local';

const fs = require('fs');
const path = require('path');
const local = require('../src/storage/local');

/** PNG 1x1 válido. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

const criados = [];

afterAll(async () => {
  for (const key of criados) await local.remover(key);
});

describe('driver local', () => {
  it('grava o arquivo e devolve a referência', async () => {
    const r = await local.salvar(PNG, { mimetype: 'image/png' });
    criados.push(r.key);

    expect(r.key).toBeTruthy();
    expect(r.url).toBe(`/uploads/${r.key}`);
    expect(r.size).toBe(PNG.length);
    expect(fs.existsSync(path.join(local.UPLOAD_DIR, r.key))).toBe(true);
  });

  it('grava o conteúdo sem alterar os bytes', async () => {
    const r = await local.salvar(PNG, { mimetype: 'image/png' });
    criados.push(r.key);

    const lido = fs.readFileSync(path.join(local.UPLOAD_DIR, r.key));
    expect(lido.equals(PNG)).toBe(true);
  });

  it('usa a extensão correspondente ao tipo MIME', async () => {
    const png = await local.salvar(PNG, { mimetype: 'image/png' });
    const jpg = await local.salvar(PNG, { mimetype: 'image/jpeg' });
    criados.push(png.key, jpg.key);

    expect(png.key).toMatch(/\.png$/);
    expect(jpg.key).toMatch(/\.jpg$/);
  });

  it('cai para .jpg em tipo desconhecido', async () => {
    const r = await local.salvar(PNG, { mimetype: 'image/tiff' });
    criados.push(r.key);
    expect(r.key).toMatch(/\.jpg$/);
  });

  it('gera nomes diferentes para envios iguais', async () => {
    const a = await local.salvar(PNG, { mimetype: 'image/png' });
    const b = await local.salvar(PNG, { mimetype: 'image/png' });
    criados.push(a.key, b.key);

    // Nome previsível permitiria sobrescrever a foto de outra pessoa.
    expect(a.key).not.toBe(b.key);
  });

  it('não guarda o nome enviado pelo cliente', async () => {
    const r = await local.salvar(PNG, {
      mimetype: 'image/png',
      originalname: '../../etc/passwd',
    });
    criados.push(r.key);

    // Chave é UUID + extensão; nada do que o cliente mandou entra nela.
    expect(r.key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/
    );
  });

  it('remove o arquivo', async () => {
    const r = await local.salvar(PNG, { mimetype: 'image/png' });
    const caminho = path.join(local.UPLOAD_DIR, r.key);

    expect(fs.existsSync(caminho)).toBe(true);
    await local.remover(r.key);
    expect(fs.existsSync(caminho)).toBe(false);
  });

  it('remover é idempotente', async () => {
    // Apagar duas vezes não deve explodir.
    await expect(local.remover('nao-existe.png')).resolves.toBeUndefined();
  });

  it('ignora diretórios na chave ao remover', async () => {
    const r = await local.salvar(PNG, { mimetype: 'image/png' });

    // Mesmo que a chave venha com caminho, só o nome do arquivo é usado.
    await local.remover(`../../${r.key}`);
    expect(fs.existsSync(path.join(local.UPLOAD_DIR, r.key))).toBe(false);
  });
});

describe('contrato entre drivers', () => {
  it('o driver selecionado expõe salvar e remover', () => {
    const storage = require('../src/storage');
    expect(typeof storage.salvar).toBe('function');
    expect(typeof storage.remover).toBe('function');
    expect(storage.nome).toBe('local');
  });
});
