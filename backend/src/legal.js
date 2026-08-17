const LEGAL_DOCUMENTS = Object.freeze({
  terms: Object.freeze({ version: '1.0', acceptedField: 'accepted_terms' }),
  privacy: Object.freeze({ version: '1.0', acceptedField: 'acknowledged_privacy' }),
});

function validateLegalAcceptance(body = {}) {
  const errors = {};

  for (const [type, document] of Object.entries(LEGAL_DOCUMENTS)) {
    if (body[document.acceptedField] !== true) {
      errors[document.acceptedField] = 'Aceite obrigatório';
    }
    if (body[`${type}_version`] !== document.version) {
      errors[`${type}_version`] = `A versão vigente é ${document.version}`;
    }
  }

  return { errors, documents: LEGAL_DOCUMENTS };
}

async function hasCurrentAcceptance(client, userId) {
  const { rows } = await client.query(
    `SELECT document_type, version
       FROM legal_acceptances
      WHERE user_id = $1
        AND ((document_type = 'terms' AND version = $2)
          OR (document_type = 'privacy' AND version = $3))`,
    [userId, LEGAL_DOCUMENTS.terms.version, LEGAL_DOCUMENTS.privacy.version]
  );
  return new Set(rows.map((row) => row.document_type)).size === 2;
}

async function recordCurrentAcceptance(client, userId) {
  await client.query(
    `INSERT INTO legal_acceptances (user_id, document_type, version)
     VALUES ($1, 'terms', $2), ($1, 'privacy', $3)
     ON CONFLICT (user_id, document_type, version) DO NOTHING`,
    [userId, LEGAL_DOCUMENTS.terms.version, LEGAL_DOCUMENTS.privacy.version]
  );
}

module.exports = {
  LEGAL_DOCUMENTS,
  validateLegalAcceptance,
  hasCurrentAcceptance,
  recordCurrentAcceptance,
};
