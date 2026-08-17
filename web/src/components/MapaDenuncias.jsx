/**
 * Mapa de denúncias com Leaflet.
 *
 * Usamos Leaflet direto, sem react-leaflet: o componente é um só, e
 * controlar o ciclo de vida na mão evita mais uma camada de dependência
 * com suas próprias exigências de versão do React.
 *
 * Os tiles vêm do OpenStreetMap, que não exige chave de API — por isso o
 * MAPBOX_TOKEN continua vazio. Ver docs/DECISOES.md #014.
 */
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';

import { api } from '../services/api';
import { classificarPrecisao } from '../utils/precisao';

/** Cor de cada categoria, usada nos marcadores e na legenda. */
export const CORES_CATEGORIA = {
  trash: '#dc2626',
  debris: '#ea580c',
  sewage: '#7c3aed',
  other: '#0891b2',
};

export const ROTULO_CATEGORIA = {
  trash: 'Lixo',
  debris: 'Entulho',
  sewage: 'Esgoto',
  other: 'Outro',
};

const ROTULO_STATUS = {
  reported: 'Enviada',
  validated: 'Confirmada',
  resolved: 'Resolvida',
  rejected: 'Rejeitada',
};

/** Brasília, usada enquanto não há nenhuma denúncia para enquadrar. */
const CENTRO_PADRAO = [-15.7942, -48.0192];

/**
 * Marcador circular colorido por categoria.
 * Círculo em vez do pino padrão do Leaflet porque o pino depende de
 * imagens que o bundler não resolve sozinho.
 */
function criarMarcador(feature) {
  const [lng, lat] = feature.geometry.coordinates;
  const cor = CORES_CATEGORIA[feature.properties.category] || CORES_CATEGORIA.other;

  return L.circleMarker([lat, lng], {
    radius: 8,
    fillColor: cor,
    color: '#fff',
    weight: 2,
    opacity: 1,
    fillOpacity: 0.85,
  });
}

/** Conteúdo do balão exibido ao clicar num marcador. */
function montarPopup({ properties: p }) {
  // onerror esconde a imagem quebrada em vez de deixar um ícone solto —
  // mas o console registra, para o problema não passar despercebido.
  const imagem = p.image_url
    ? `<img src="${api.imagemUrl(p.image_url)}" alt="Foto da denúncia"
           style="width:100%;border-radius:6px;margin-bottom:6px"
           onerror="this.style.display='none';console.warn('Falha ao carregar foto:', this.src)" />`
    : '';

  const data = new Date(p.created_at).toLocaleString('pt-BR');
  const prec = classificarPrecisao(p.accuracy_meters);

  return `
    <div style="min-width:200px;max-width:240px">
      ${imagem}
      <strong>${escapar(p.title)}</strong>
      ${p.description ? `<p style="margin:4px 0;color:#475569">${escapar(p.description)}</p>` : ''}
      <div style="font-size:12px;color:#64748b;margin-top:6px">
        ${ROTULO_CATEGORIA[p.category] || p.category} ·
        ${ROTULO_STATUS[p.status] || p.status}<br/>${data}
      </div>
      <div style="font-size:12px;color:${prec.cor};margin-top:4px" title="${escapar(prec.descricao)}">
        ${prec.rotulo}
      </div>
    </div>
  `;
}

/**
 * Escapa texto que vai para o HTML do popup.
 * O título e a descrição são digitados pelo usuário; injetá-los crus
 * abriria XSS para quem visse o mapa.
 */
function escapar(texto = '') {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

/**
 * @param {object} props
 * @param {object} props.geojson - FeatureCollection vinda de /map/geojson
 * @param {boolean} [props.modoCalor] - mapa de calor em vez de marcadores
 * @param {number} [props.altura=520]
 */
export default function MapaDenuncias({ geojson, modoCalor = false, altura = 520 }) {
  const containerRef = useRef(null);
  const mapaRef = useRef(null);
  const camadaRef = useRef(null);

  // Cria o mapa uma única vez. Recriar a cada render perderia o zoom e a
  // posição que o usuário escolheu.
  useEffect(() => {
    if (mapaRef.current || !containerRef.current) return;

    const mapa = L.map(containerRef.current).setView(CENTRO_PADRAO, 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(mapa);

    mapaRef.current = mapa;

    return () => {
      mapa.remove();
      mapaRef.current = null;
    };
  }, []);

  // Redesenha a camada de dados quando os pontos ou o modo mudam.
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !geojson) return;

    if (camadaRef.current) {
      mapa.removeLayer(camadaRef.current);
      camadaRef.current = null;
    }

    const features = geojson.features || [];
    if (features.length === 0) return;

    if (modoCalor) {
      const pontos = features.map((f) => {
        const [lng, lat] = f.geometry.coordinates;
        return [lat, lng, 0.6];
      });
      camadaRef.current = L.heatLayer(pontos, {
        radius: 25,
        blur: 18,
        maxZoom: 16,
      }).addTo(mapa);
    } else {
      const grupo = L.layerGroup(
        features.map((f) => criarMarcador(f).bindPopup(montarPopup(f)))
      );
      camadaRef.current = grupo.addTo(mapa);
    }

    // Enquadra todos os pontos. Só na primeira carga — reenquadrar a cada
    // atualização atrapalharia quem estivesse navegando pelo mapa.
    if (!mapa._jaEnquadrou) {
      const limites = L.latLngBounds(
        features.map((f) => {
          const [lng, lat] = f.geometry.coordinates;
          return [lat, lng];
        })
      );
      mapa.fitBounds(limites, { padding: [40, 40], maxZoom: 16 });
      mapa._jaEnquadrou = true;
    }
  }, [geojson, modoCalor]);

  return <div ref={containerRef} style={{ height: altura, borderRadius: 12 }} />;
}
