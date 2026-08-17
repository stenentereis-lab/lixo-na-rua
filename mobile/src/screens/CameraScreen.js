/**
 * Captura da denúncia: foto + coordenadas.
 *
 * O fluxo tem duas etapas na mesma tela:
 *   1. câmera aberta, aguardando a foto
 *   2. revisão — foto tirada, usuário preenche título e categoria
 *
 * A localização é lida em paralelo, assim que a tela abre, para já estar
 * pronta quando a foto for tirada. Buscar GPS só depois faria o usuário
 * esperar parado na rua.
 */
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';

import { api } from '../services/api';
import { cores, espaco, raio, CATEGORIAS } from '../theme';

export default function CameraScreen({ navigation }) {
  const cameraRef = useRef(null);

  // Hook do expo-camera 17: devolve o estado da permissão e a função
  // que a solicita, sem precisar controlar isso na mão.
  const [permissaoCamera, pedirPermissaoCamera] = useCameraPermissions();

  const [foto, setFoto] = useState(null);
  const [local, setLocal] = useState(null);
  const [erroLocal, setErroLocal] = useState('');

  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('trash');

  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    pedirPermissoes();
  }, []);

  async function pedirPermissoes() {
    if (!permissaoCamera?.granted) {
      await pedirPermissaoCamera();
    }

    // Localização em paralelo: quando a foto sair, a coordenada já estará lá.
    const loc = await Location.requestForegroundPermissionsAsync();
    if (loc.status !== 'granted') {
      setErroLocal('Sem permissão de localização');
      return;
    }

    try {
      const posicao = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLocal(posicao.coords);
    } catch {
      setErroLocal('Não consegui obter sua localização');
    }
  }

  async function tirarFoto() {
    if (!cameraRef.current) return;

    try {
      const resultado = await cameraRef.current.takePictureAsync({
        quality: 0.7, // menor upload, qualidade suficiente para identificar lixo
      });
      setFoto(resultado);

      // Se a leitura inicial falhou, tenta de novo agora.
      if (!local) tentarLocalizacaoNovamente();
    } catch {
      Alert.alert('Erro', 'Não consegui tirar a foto. Tente novamente.');
    }
  }

  async function tentarLocalizacaoNovamente() {
    setErroLocal('');
    try {
      const posicao = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLocal(posicao.coords);
    } catch {
      setErroLocal('Não consegui obter sua localização');
    }
  }

  async function enviar() {
    if (!titulo.trim()) {
      Alert.alert('Falta o título', 'Descreva em poucas palavras o que você viu.');
      return;
    }
    if (!local) {
      Alert.alert(
        'Sem localização',
        'A denúncia precisa da coordenada para aparecer no mapa. Ative o GPS e toque em "Tentar novamente".'
      );
      return;
    }

    setEnviando(true);
    try {
      // Duas etapas: primeiro a imagem, depois a denúncia com a URL.
      const { url } = await api.uploadFoto(foto.uri);

      await api.criarDenuncia({
        title: titulo.trim(),
        description: descricao.trim() || undefined,
        latitude: local.latitude,
        longitude: local.longitude,
        // Raio de incerteza do GPS. Distingue "o lixo está neste ponto"
        // de "está em algum lugar deste quarteirão" — informação que a
        // moderação e o órgão público precisam para agir.
        accuracy_meters: local.accuracy ?? undefined,
        category: categoria,
        image_url: url,
      });

      Alert.alert('Denúncia enviada', 'Obrigado por ajudar a cuidar da cidade!', [
        { text: 'OK', onPress: reiniciar },
      ]);
    } catch (err) {
      Alert.alert('Não foi possível enviar', err.message);
    } finally {
      setEnviando(false);
    }
  }

  function reiniciar() {
    setFoto(null);
    setTitulo('');
    setDescricao('');
    setCategoria('trash');
    navigation.navigate('Minhas denúncias');
  }

  // ---------- permissão ----------

  // undefined enquanto o hook ainda não consultou o sistema.
  if (!permissaoCamera) {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator size="large" color={cores.primaria} />
      </View>
    );
  }

  if (!permissaoCamera.granted) {
    return (
      <View style={estilos.centro}>
        <Text style={estilos.aviso}>
          Precisamos da câmera para você fotografar o lixo.
        </Text>
        <Text style={estilos.avisoSuave}>
          Abra os ajustes do celular e libere o acesso à câmera para o Lixo na Rua.
        </Text>
        <TouchableOpacity style={estilos.botao} onPress={pedirPermissoes}>
          <Text style={estilos.botaoTexto}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ---------- etapa 1: câmera ----------

  if (!foto) {
    return (
      <View style={estilos.container}>
        <CameraView ref={cameraRef} style={estilos.camera} facing="back" />

        <View style={estilos.barraInferior}>
          <Text style={estilos.statusGps}>
            {local
              ? `📍 Localização pronta (±${Math.round(local.accuracy || 0)}m)`
              : erroLocal || 'Obtendo localização...'}
          </Text>

          <TouchableOpacity
            style={estilos.disparador}
            onPress={tirarFoto}
            accessibilityLabel="Tirar foto"
          >
            <View style={estilos.disparadorInterno} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ---------- etapa 2: revisão ----------

  return (
    <KeyboardAvoidingView
      style={estilos.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={estilos.formulario}>
        <Image source={{ uri: foto.uri }} style={estilos.previa} />

        <TouchableOpacity onPress={() => setFoto(null)}>
          <Text style={estilos.link}>Tirar outra foto</Text>
        </TouchableOpacity>

        <View style={estilos.caixaLocal}>
          {local ? (
            <Text style={estilos.localTexto}>
              📍 {local.latitude.toFixed(5)}, {local.longitude.toFixed(5)}
            </Text>
          ) : (
            <>
              <Text style={estilos.localErro}>
                {erroLocal || 'Sem localização'}
              </Text>
              <TouchableOpacity onPress={tentarLocalizacaoNovamente}>
                <Text style={estilos.link}>Tentar novamente</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <Text style={estilos.rotulo}>O que você viu?</Text>
        <TextInput
          style={estilos.campo}
          value={titulo}
          onChangeText={setTitulo}
          placeholder="Ex.: Lixo acumulado na calçada"
          maxLength={140}
        />

        <Text style={estilos.rotulo}>Detalhes (opcional)</Text>
        <TextInput
          style={[estilos.campo, estilos.campoMultilinha]}
          value={descricao}
          onChangeText={setDescricao}
          placeholder="Há quanto tempo está lá, tamanho, referências..."
          multiline
          numberOfLines={3}
          maxLength={2000}
        />

        <Text style={estilos.rotulo}>Categoria</Text>
        <View style={estilos.categorias}>
          {CATEGORIAS.map((c) => (
            <TouchableOpacity
              key={c.valor}
              style={[
                estilos.chip,
                categoria === c.valor && estilos.chipAtivo,
              ]}
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
        </View>

        <TouchableOpacity
          style={[estilos.botao, enviando && estilos.botaoDesativado]}
          onPress={enviar}
          disabled={enviando}
        >
          {enviando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={estilos.botaoTexto}>Enviar denúncia</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundo },
  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: espaco.lg,
    backgroundColor: cores.fundoClaro,
  },
  camera: { flex: 1 },

  barraInferior: {
    paddingVertical: espaco.lg,
    alignItems: 'center',
    backgroundColor: cores.fundo,
  },
  statusGps: {
    color: cores.textoClaro,
    fontSize: 13,
    marginBottom: espaco.md,
  },
  disparador: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disparadorInterno: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
  },

  formulario: {
    padding: espaco.md,
    backgroundColor: cores.fundoClaro,
    flexGrow: 1,
  },
  previa: {
    width: '100%',
    height: 240,
    borderRadius: raio.md,
    marginBottom: espaco.sm,
    backgroundColor: '#000',
  },
  link: {
    color: cores.primaria,
    fontWeight: '600',
    marginBottom: espaco.md,
  },

  caixaLocal: {
    backgroundColor: '#fff',
    borderRadius: raio.sm,
    padding: espaco.md,
    marginBottom: espaco.md,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  localTexto: { color: cores.texto, fontSize: 14 },
  localErro: { color: cores.erro, fontSize: 14, marginBottom: espaco.xs },

  rotulo: {
    fontSize: 14,
    fontWeight: '600',
    color: cores.texto,
    marginBottom: espaco.xs,
  },
  campo: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: raio.sm,
    padding: espaco.md,
    fontSize: 16,
    marginBottom: espaco.md,
    color: cores.texto,
  },
  campoMultilinha: { height: 90, textAlignVertical: 'top' },

  categorias: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espaco.sm,
    marginBottom: espaco.lg,
  },
  chip: {
    paddingVertical: espaco.sm,
    paddingHorizontal: espaco.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: '#fff',
  },
  chipAtivo: { backgroundColor: cores.primaria, borderColor: cores.primaria },
  chipTexto: { color: cores.textoSuave, fontWeight: '600' },
  chipTextoAtivo: { color: '#fff' },

  botao: {
    backgroundColor: cores.primaria,
    padding: espaco.md,
    borderRadius: raio.sm,
    alignItems: 'center',
    marginTop: espaco.sm,
  },
  botaoDesativado: { opacity: 0.6 },
  botaoTexto: { color: '#fff', fontSize: 16, fontWeight: '700' },

  aviso: {
    fontSize: 17,
    fontWeight: '600',
    color: cores.texto,
    textAlign: 'center',
    marginBottom: espaco.sm,
  },
  avisoSuave: {
    fontSize: 14,
    color: cores.textoSuave,
    textAlign: 'center',
    marginBottom: espaco.lg,
  },
});
