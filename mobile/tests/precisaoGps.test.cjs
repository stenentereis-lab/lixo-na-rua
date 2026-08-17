const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PRECISAO_MAXIMA_METROS,
  avaliarLocalizacao,
} = require('../src/utils/precisaoGps.cjs');

const AGORA = 1_000_000;

test('aceita coordenada recente com margem de até 20 metros', () => {
  assert.equal(
    avaliarLocalizacao({ accuracy: PRECISAO_MAXIMA_METROS, timestamp: AGORA }, AGORA).aceita,
    true
  );
});

test('rejeita as margens de 700 e 1600 metros observadas em produção', () => {
  for (const accuracy of [700, 1600]) {
    const resultado = avaliarLocalizacao({ accuracy, timestamp: AGORA }, AGORA);
    assert.equal(resultado.aceita, false);
    assert.equal(resultado.motivo, 'imprecisa');
  }
});

test('rejeita coordenada antiga mesmo quando a margem é pequena', () => {
  const resultado = avaliarLocalizacao({ accuracy: 5, timestamp: AGORA - 10_001 }, AGORA);
  assert.equal(resultado.aceita, false);
  assert.equal(resultado.motivo, 'antiga');
});

test('rejeita coordenada cuja precisão não foi informada', () => {
  const resultado = avaliarLocalizacao({ accuracy: null, timestamp: AGORA }, AGORA);
  assert.equal(resultado.aceita, false);
  assert.equal(resultado.motivo, 'precisao_desconhecida');
});
