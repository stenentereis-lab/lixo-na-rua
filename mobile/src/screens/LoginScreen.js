/**
 * Login e cadastro, alternando no mesmo formulário.
 */
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from '../context/AuthContext';
import { API_URL, apiUrlSuspeita } from '../services/api';
import { cores, espaco, raio } from '../theme';

export default function LoginScreen() {
  const { login, register } = useAuth();

  const [modo, setModo] = useState('login');
  const [form, setForm] = useState({ nome: '', email: '', password: '' });
  const [erro, setErro] = useState('');
  const [erroCampo, setErroCampo] = useState({});
  const [enviando, setEnviando] = useState(false);

  const isCadastro = modo === 'cadastro';

  function alterar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
    setErroCampo((e) => ({ ...e, [campo]: undefined }));
  }

  async function enviar() {
    setErro('');
    setErroCampo({});
    setEnviando(true);

    try {
      if (isCadastro) await register(form);
      else await login(form.email, form.password);
    } catch (err) {
      setErro(err.message);
      setErroCampo(err.details || {});
    } finally {
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={estilos.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={estilos.scroll}>
        <View style={estilos.cartao}>
          <Text style={estilos.titulo}>Lixo na Rua</Text>
          <Text style={estilos.subtitulo}>
            {isCadastro
              ? 'Crie sua conta para começar a denunciar'
              : 'Entre para acompanhar suas denúncias'}
          </Text>

          {!!erro && (
            <View style={estilos.alerta}>
              <Text style={estilos.alertaTexto}>{erro}</Text>
            </View>
          )}

          {isCadastro && (
            <>
              <Text style={estilos.rotulo}>Nome</Text>
              <TextInput
                style={estilos.campo}
                value={form.nome}
                onChangeText={(v) => alterar('nome', v)}
                placeholder="Maria Silva"
                autoCapitalize="words"
              />
              {!!erroCampo.nome && (
                <Text style={estilos.erroCampo}>{erroCampo.nome}</Text>
              )}
            </>
          )}

          <Text style={estilos.rotulo}>E-mail</Text>
          <TextInput
            style={estilos.campo}
            value={form.email}
            onChangeText={(v) => alterar('email', v)}
            placeholder="voce@exemplo.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {!!erroCampo.email && (
            <Text style={estilos.erroCampo}>{erroCampo.email}</Text>
          )}

          <Text style={estilos.rotulo}>Senha</Text>
          <TextInput
            style={estilos.campo}
            value={form.password}
            onChangeText={(v) => alterar('password', v)}
            placeholder={isCadastro ? 'Mínimo 8 caracteres' : ''}
            secureTextEntry
            autoCapitalize="none"
          />
          {!!erroCampo.password && (
            <Text style={estilos.erroCampo}>{erroCampo.password}</Text>
          )}

          <TouchableOpacity
            style={[estilos.botao, enviando && estilos.botaoDesativado]}
            onPress={enviar}
            disabled={enviando}
          >
            {enviando ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={estilos.botaoTexto}>
                {isCadastro ? 'Criar conta' : 'Entrar'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setModo(isCadastro ? 'login' : 'cadastro');
              setErro('');
              setErroCampo({});
            }}
          >
            <Text style={estilos.alternar}>
              {isCadastro ? 'Já tem conta? Entrar' : 'Ainda não tem conta? Cadastre-se'}
            </Text>
          </TouchableOpacity>

          {/* Ajuda no diagnóstico quando o celular não acha o backend. */}
          {apiUrlSuspeita() && (
            <View style={estilos.avisoConfig}>
              <Text style={estilos.avisoConfigTitulo}>
                Endereço do servidor não detectado
              </Text>
              <Text style={estilos.avisoConfigTexto}>
                O app vai tentar {API_URL}, que num celular aponta para o
                próprio aparelho. Abra mobile/app.json e defina
                {' "extra": { "apiUrl": "http://SEU_IP:3000" }'}.
              </Text>
            </View>
          )}
          <Text style={estilos.rodape}>API: {API_URL}</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundo },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: espaco.md },

  cartao: {
    backgroundColor: cores.cartao,
    borderRadius: raio.lg,
    padding: espaco.lg,
  },
  titulo: { fontSize: 28, fontWeight: '700', color: cores.texto },
  subtitulo: {
    fontSize: 14,
    color: cores.textoSuave,
    marginTop: espaco.xs,
    marginBottom: espaco.lg,
  },

  alerta: {
    backgroundColor: cores.erroFundo,
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: raio.sm,
    padding: espaco.md,
    marginBottom: espaco.md,
  },
  alertaTexto: { color: '#b91c1c', fontSize: 14 },

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
  erroCampo: {
    color: cores.erro,
    fontSize: 12,
    marginTop: -espaco.sm,
    marginBottom: espaco.md,
  },

  botao: {
    backgroundColor: cores.primaria,
    padding: espaco.md,
    borderRadius: raio.sm,
    alignItems: 'center',
    marginTop: espaco.sm,
  },
  botaoDesativado: { opacity: 0.6 },
  botaoTexto: { color: '#fff', fontSize: 16, fontWeight: '700' },

  alternar: {
    textAlign: 'center',
    color: cores.primaria,
    fontWeight: '600',
    marginTop: espaco.md,
  },
  rodape: {
    textAlign: 'center',
    color: cores.textoSuave,
    fontSize: 11,
    marginTop: espaco.md,
  },

  avisoConfig: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: raio.sm,
    padding: espaco.md,
    marginTop: espaco.lg,
  },
  avisoConfigTitulo: {
    color: '#92400e',
    fontWeight: '700',
    fontSize: 13,
    marginBottom: espaco.xs,
  },
  avisoConfigTexto: { color: '#92400e', fontSize: 12, lineHeight: 17 },
});
