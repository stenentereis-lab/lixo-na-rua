/**
 * Mapa das denúncias próximas.
 *
 * Serve a dois propósitos: mostrar o problema do bairro e evitar
 * duplicatas — antes de denunciar, a pessoa vê se aquele ponto já foi
 * registrado por outra.
 *
 * Sobre o provedor de mapa: no Expo Go funciona sem configuração, porque
 * o próprio Expo Go traz a chave do Google Maps. Numa build própria para
 * Android será preciso uma chave — ver docs/DEPLOY.md.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Callout, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, API_URL } from '../services/api';
import { cores, espaco, raio, CATEGORIAS } from '../theme';

/** Cor de cada categoria, a mesma usada no mapa do web. */
const COR_CATEGORIA = {
  trash: '#dc2626',
  debris: '#ea580c',
  sewage: '#7c3aed',
  other: '#0891b2',
};

const ROTULO_STATUS = {
  reported: 'Enviada',
  validated: 'Confirmada',
  resolved: 'Resolvida',
  rejected: 'Rejeitada',
};

/** Opções de raio, em metros. */
const RAIOS = [500, 1000, 5000];

/**
 * Converte metros no delta de latitude que o mapa usa para o zoom.
 * 1 grau ≈ 111.320 m; o fator 2.5 dá uma folga em volta do círculo.
 */
function deltaParaRaio(metros) {
  return (metros * 2.5) / 111320;
}

export default function MapScreen() {
  const mapaRef = useRef(null);
  // Sem isto os controles ficam por baixo do relógio e da bateria.
  const margens = useSafeAreaInsets();

  const [local, setLocal] = useState(null);
  const [denuncias, setDenuncias] = useState([]);
  const [distancia, setDistancia] = useState(1000);
  const [categoria, setCategoria] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  // Recarrega ao voltar para a aba: uma denúncia enviada agora deve
  // aparecer sem o usuário precisar reabrir o app.
  useFocusEffect(
    useCallback(() => {
      iniciar();
    }, [distancia, categoria])
  );

  async function iniciar() {
    setErro('');

    try {
      const permissao = await Location.requestForegroundPermissionsAsync();
      if (permissao.status !== 'granted') {
        setErro('Sem permissão de localização para centralizar o mapa.');
        setCarregando(false);
        return;
      }

      const posicao = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = {
        latitude: posicao.coords.latitude,
        longitude: posicao.coords.longitude,
      };
      setLocal(coords);
      await buscar(coords);
    } catch (err) {
      setErro(err.message || 'Não consegui obter sua localização.');
      setCarregando(false);
    }
  }

  async function buscar(coords) {
    try {
      const { data } = await api.proximas({
        lat: coords.latitude,
        lng: coords.longitude,
        radius: distancia,
        category: categoria,
      });
      setDenuncias(data);
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  function centralizar() {
    if (!local || !mapaRef.current) return;
    const delta = deltaParaRaio(distancia);
    mapaRef.current.animateToRegion(
      { ...local, latitudeDelta: delta, longitudeDelta: delta },
      500
    );
  }

  // Reenquadra ao trocar o raio. Sem isto os botões mudam a busca mas o
  // zoom continua igual, e parece que nada aconteceu.
  useEffect(() => {
    centralizar();
  }, [distancia, local]);

  if (carregando && !local) {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator size="large" color={cores.primaria} />
        <Text style={estilos.carregandoTexto}>Localizando você...</Text>
      </View>
    );
  }

  if (!local) {
    return (
      <View style={estilos.centro}>
        <Text style={estilos.aviso}>{erro || 'Sem localização'}</Text>
        <TouchableOpacity style={estilos.botao} onPress={iniciar}>
          <Text style={estilos.botaoTexto}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const delta = deltaParaRaio(distancia);

  return (
    <View style={estilos.container}>
      <MapView
        ref={mapaRef}
        style={estilos.mapa}
        initialRegion={{ ...local, latitudeDelta: delta, longitudeDelta: delta }}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {/* Mostra até onde a busca alcança, para o número de pontos
            fazer sentido. */}
        <Circle
          center={local}
          radius={distancia}
          strokeColor="rgba(61,122,22,0.5)"
          fillColor="rgba(124,175,46,0.12)"
          strokeWidth={2}
        />

        {denuncias.map((d) => (
          <Marker
            key={d.id}
            coordinate={{
              latitude: Number(d.latitude),
              longitude: Number(d.longitude),
            }}
            pinColor={COR_CATEGORIA[d.category] || COR_CATEGORIA.other}
          >
            <Callout tooltip>
              <View style={estilos.balao}>
                {!!d.image_url && (
                  <Image
                    source={{ uri: `${API_URL}${d.image_url}` }}
                    style={estilos.balaoFoto}
                  />
                )}
                <Text style={estilos.balaoTitulo} numberOfLines={2}>
                  {d.title}
                </Text>
                <Text style={estilos.balaoMeta}>
                  {ROTULO_STATUS[d.status] || d.status}
                  {d.distance_meters != null && ` · ${d.distance_meters} m daqui`}
                </Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {/* ---------- controles sobre o mapa ---------- */}

      {/* O topo respeita a area segura e deixa 56px livres a direita,
          onde iOS e Android desenham bussola e botoes proprios. */}
      <View style={[estilos.barraTopo, { top: margens.top + espaco.sm }]}>
        <View style={estilos.grupo}>
          {RAIOS.map((r) => (
            <TouchableOpacity
              key={r}
              style={[estilos.chip, distancia === r && estilos.chipAtivo]}
              onPress={() => setDistancia(r)}
            >
              <Text
                style={[
                  estilos.chipTexto,
                  distancia === r && estilos.chipTextoAtivo,
                ]}
              >
                {r >= 1000 ? `${r / 1000} km` : `${r} m`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Rolagem horizontal em vez de quebra de linha: com quebra, as
            categorias empurravam o mapa e colidiam com a bussola. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={estilos.grupo}
          style={estilos.rolagem}
        >
          <TouchableOpacity
            style={[estilos.chip, !categoria && estilos.chipAtivo]}
            onPress={() => setCategoria(null)}
          >
            <Text
              style={[estilos.chipTexto, !categoria && estilos.chipTextoAtivo]}
            >
              Todas
            </Text>
          </TouchableOpacity>

          {CATEGORIAS.map((c) => (
            <TouchableOpacity
              key={c.valor}
              style={[estilos.chip, categoria === c.valor && estilos.chipAtivo]}
              onPress={() => setCategoria(c.valor)}
            >
              <Text
                style={[
                  estilos.chipTexto,
                  categoria === c.valor && estilos.chipTextoAtivo,
                ]}
              >
                {c.rotulo}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={[estilos.barraBaixo, { bottom: margens.bottom + espaco.sm }]}>
        <View style={estilos.resumo}>
          <Text style={estilos.resumoTexto}>
            {carregando
              ? 'Buscando...'
              : `${denuncias.length} ${
                  denuncias.length === 1 ? 'denúncia' : 'denúncias'
                } por perto`}
          </Text>
          {!!erro && <Text style={estilos.resumoErro}>{erro}</Text>}
        </View>

        <TouchableOpacity style={estilos.botaoRedondo} onPress={centralizar}>
          <Text style={estilos.botaoRedondoTexto}>◎</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1 },
  mapa: { flex: 1 },

  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: espaco.lg,
    backgroundColor: cores.fundoClaro,
  },
  carregandoTexto: { marginTop: espaco.md, color: cores.textoSuave },
  aviso: {
    fontSize: 16,
    color: cores.texto,
    textAlign: 'center',
    marginBottom: espaco.md,
  },

  barraTopo: {
    position: 'absolute',
    left: espaco.md,
    // Espaço à direita para a bússola do iOS e os controles do Android.
    right: 56,
    gap: espaco.sm,
  },
  grupo: { flexDirection: 'row', gap: espaco.xs, alignItems: 'center' },
  rolagem: { flexGrow: 0 },

  chip: {
    paddingVertical: 6,
    paddingHorizontal: espaco.md,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: cores.borda,
  },
  chipAtivo: { backgroundColor: cores.primaria, borderColor: cores.primaria },
  chipTexto: { color: cores.texto, fontSize: 13, fontWeight: '600' },
  chipTextoAtivo: { color: '#fff' },

  barraBaixo: {
    position: 'absolute',
    left: espaco.md,
    right: espaco.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.sm,
  },
  resumo: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: raio.sm,
    paddingVertical: espaco.sm,
    paddingHorizontal: espaco.md,
  },
  resumoTexto: { color: cores.texto, fontWeight: '600', fontSize: 14 },
  resumoErro: { color: cores.erro, fontSize: 12, marginTop: 2 },

  botaoRedondo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: cores.primaria,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoRedondoTexto: { color: '#fff', fontSize: 22, lineHeight: 26 },

  balao: {
    width: 200,
    backgroundColor: '#fff',
    borderRadius: raio.sm,
    padding: espaco.sm,
  },
  balaoFoto: {
    width: '100%',
    height: 110,
    borderRadius: 6,
    marginBottom: espaco.xs,
    backgroundColor: cores.borda,
  },
  balaoTitulo: { fontWeight: '700', color: cores.texto, fontSize: 14 },
  balaoMeta: { color: cores.textoSuave, fontSize: 12, marginTop: 2 },

  botao: {
    backgroundColor: cores.primaria,
    paddingVertical: espaco.md,
    paddingHorizontal: espaco.lg,
    borderRadius: raio.sm,
  },
  botaoTexto: { color: '#fff', fontWeight: '700' },
});
