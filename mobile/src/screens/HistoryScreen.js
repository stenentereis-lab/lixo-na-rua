/**
 * Denúncias enviadas pelo usuário.
 */
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { api, API_URL } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { cores, espaco, raio, CATEGORIAS } from '../theme';

const ROTULO_STATUS = {
  reported: { texto: 'Enviada', cor: cores.alerta },
  validated: { texto: 'Confirmada', cor: cores.primaria },
  resolved: { texto: 'Resolvida', cor: cores.sucesso },
  rejected: { texto: 'Rejeitada', cor: cores.erro },
};

export default function HistoryScreen() {
  const { user, logout } = useAuth();

  const [denuncias, setDenuncias] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState('');

  // useFocusEffect e não useEffect: a lista precisa recarregar toda vez que
  // a aba ganha foco, senão uma denúncia recém-enviada não apareceria.
  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [])
  );

  async function carregar() {
    setErro('');
    try {
      const { data } = await api.listarDenuncias('?mine=true&limit=50');
      setDenuncias(data);
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }

  function aoPuxar() {
    setAtualizando(true);
    carregar();
  }

  if (carregando) {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator size="large" color={cores.primaria} />
      </View>
    );
  }

  return (
    <View style={estilos.container}>
      <View style={estilos.topo}>
        <View>
          <Text style={estilos.saudacao}>Olá, {user?.nome?.split(' ')[0]}</Text>
          <Text style={estilos.contador}>
            {denuncias.length}{' '}
            {denuncias.length === 1 ? 'denúncia enviada' : 'denúncias enviadas'}
          </Text>
        </View>
        <TouchableOpacity onPress={logout}>
          <Text style={estilos.sair}>Sair</Text>
        </TouchableOpacity>
      </View>

      {!!erro && (
        <View style={estilos.alerta}>
          <Text style={estilos.alertaTexto}>{erro}</Text>
        </View>
      )}

      <FlatList
        data={denuncias}
        keyExtractor={(item) => item.id}
        contentContainerStyle={estilos.lista}
        refreshControl={
          <RefreshControl refreshing={atualizando} onRefresh={aoPuxar} />
        }
        ListEmptyComponent={
          !erro && (
            <View style={estilos.vazio}>
              <Text style={estilos.vazioTitulo}>Nenhuma denúncia ainda</Text>
              <Text style={estilos.vazioTexto}>
                Toque na aba Denunciar para registrar a primeira.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const status = ROTULO_STATUS[item.status] || ROTULO_STATUS.reported;
          const categoria = CATEGORIAS.find((c) => c.valor === item.category);

          return (
            <View style={estilos.cartao}>
              {!!item.image_url && (
                <Image
                  source={{ uri: `${API_URL}${item.image_url}` }}
                  style={estilos.foto}
                />
              )}

              <View style={estilos.conteudo}>
                <Text style={estilos.titulo}>{item.title}</Text>

                {!!item.description && (
                  <Text style={estilos.descricao} numberOfLines={2}>
                    {item.description}
                  </Text>
                )}

                <View style={estilos.linha}>
                  <View style={[estilos.selo, { backgroundColor: status.cor }]}>
                    <Text style={estilos.seloTexto}>{status.texto}</Text>
                  </View>
                  <Text style={estilos.meta}>{categoria?.rotulo}</Text>
                </View>

                <Text style={estilos.coordenadas}>
                  📍 {Number(item.latitude).toFixed(5)},{' '}
                  {Number(item.longitude).toFixed(5)}
                </Text>
                <Text style={estilos.data}>
                  {new Date(item.created_at).toLocaleString('pt-BR')}
                </Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundoClaro },
  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cores.fundoClaro,
  },

  topo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: espaco.md,
    backgroundColor: cores.fundo,
  },
  saudacao: { color: cores.textoClaro, fontSize: 18, fontWeight: '700' },
  contador: { color: '#cbd5e1', fontSize: 13, marginTop: 2 },
  sair: { color: '#cbd5e1', fontSize: 14, fontWeight: '600' },

  alerta: {
    backgroundColor: cores.erroFundo,
    padding: espaco.md,
    margin: espaco.md,
    borderRadius: raio.sm,
  },
  alertaTexto: { color: '#b91c1c', fontSize: 13 },

  lista: { padding: espaco.md, flexGrow: 1 },

  cartao: {
    backgroundColor: '#fff',
    borderRadius: raio.md,
    marginBottom: espaco.md,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  foto: { width: '100%', height: 180, backgroundColor: '#e2e8f0' },
  conteudo: { padding: espaco.md },
  titulo: { fontSize: 16, fontWeight: '700', color: cores.texto },
  descricao: { fontSize: 14, color: cores.textoSuave, marginTop: espaco.xs },

  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.sm,
    marginTop: espaco.sm,
  },
  selo: {
    paddingHorizontal: espaco.sm,
    paddingVertical: 3,
    borderRadius: 999,
  },
  seloTexto: { color: '#fff', fontSize: 11, fontWeight: '700' },
  meta: { fontSize: 12, color: cores.textoSuave },

  coordenadas: { fontSize: 12, color: cores.textoSuave, marginTop: espaco.sm },
  data: { fontSize: 11, color: cores.textoSuave, marginTop: 2 },

  vazio: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  vazioTitulo: { fontSize: 16, fontWeight: '600', color: cores.texto },
  vazioTexto: {
    fontSize: 14,
    color: cores.textoSuave,
    marginTop: espaco.xs,
    textAlign: 'center',
  },
});
