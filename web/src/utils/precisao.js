/**
 * Formatação e classificação da precisão do GPS.
 *
 * O número cru (±3.7 m) diz pouco para quem modera. O que importa é a
 * pergunta prática: dá para achar o lixo com essa coordenada?
 */

/**
 * Classifica a precisão em faixas úteis para decisão.
 *
 * Os cortes vêm do uso: até 10 m identifica o ponto na calçada; até 50 m
 * dá o quarteirão; acima disso, só a região.
 *
 * @param {number|null|undefined} metros
 * @returns {{ nivel: string, rotulo: string, cor: string, descricao: string }}
 */
export function classificarPrecisao(metros) {
  if (metros === null || metros === undefined) {
    return {
      nivel: 'desconhecida',
      rotulo: 'Sem precisão',
      cor: '#94a3b8',
      descricao: 'O aparelho não informou a precisão desta coordenada',
    };
  }

  if (metros <= 10) {
    return {
      nivel: 'alta',
      rotulo: `±${formatar(metros)}`,
      cor: '#16a34a',
      descricao: 'Localização exata — dá para achar o ponto na calçada',
    };
  }

  if (metros <= 50) {
    return {
      nivel: 'media',
      rotulo: `±${formatar(metros)}`,
      cor: '#d97706',
      descricao: 'Aproximada — indica o quarteirão, não o ponto exato',
    };
  }

  return {
    nivel: 'baixa',
    rotulo: `±${formatar(metros)}`,
    cor: '#dc2626',
    descricao: 'Imprecisa — indica só a região. Pode dificultar a coleta',
  };
}

/**
 * Formata a distância na unidade que faz sentido para o valor.
 * @param {number} metros
 * @returns {string}
 */
export function formatar(metros) {
  if (metros >= 1000) return `${(metros / 1000).toFixed(1)} km`;
  if (metros >= 100) return `${Math.round(metros)} m`;
  // Abaixo de 100 m a casa decimal importa: 3,7 m e 9,4 m são bem
  // diferentes na prática.
  return `${metros.toFixed(1).replace('.', ',')} m`;
}
