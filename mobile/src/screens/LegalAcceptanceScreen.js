import { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from '../context/AuthContext';
import { cores, espaco, raio } from '../theme';

export default function LegalAcceptanceScreen() {
  const { acceptLegal, logout } = useAuth();
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!terms || !privacy) return;
    setLoading(true);
    setError('');
    try {
      await acceptLegal({
        accepted_terms: true,
        terms_version: '1.0',
        acknowledged_privacy: true,
        privacy_version: '1.0',
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const Row = ({ checked, toggle, text, url }) => (
    <TouchableOpacity style={styles.row} onPress={toggle}>
      <Text style={styles.checkbox}>{checked ? '☑' : '☐'}</Text>
      <Text style={styles.text}>Li e {text} </Text>
      <Text style={styles.link} onPress={() => Linking.openURL(url)}>abrir documento</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Documentos atualizados</Text>
        <Text style={styles.subtitle}>Leia e confirme os documentos para continuar.</Text>
        {!!error && <Text style={styles.error}>{error}</Text>}
        <Row checked={terms} toggle={() => setTerms((v) => !v)} text="aceito os Termos de Uso (v1.0)." url="https://lixonarua.brconsultorias.com/legal/termos.html" />
        <Row checked={privacy} toggle={() => setPrivacy((v) => !v)} text="estou ciente da Política de Privacidade (v1.0)." url="https://lixonarua.brconsultorias.com/legal/privacidade.html" />
        <TouchableOpacity style={[styles.button, (!terms || !privacy) && styles.disabled]} disabled={!terms || !privacy || loading} onPress={submit}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Aceitar e continuar</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={logout}><Text style={styles.exit}>Sair</Text></TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: espaco.md, backgroundColor: cores.fundoClaro },
  card: { backgroundColor: '#fff', padding: espaco.lg, borderRadius: raio.lg, gap: espaco.md },
  title: { fontSize: 24, fontWeight: '700', color: cores.texto },
  subtitle: { color: cores.textoSuave },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  checkbox: { fontSize: 24, color: cores.primaria, marginRight: espaco.xs },
  text: { color: cores.texto, fontSize: 14 },
  link: { color: cores.primaria, fontWeight: '700', fontSize: 14 },
  button: { backgroundColor: cores.primaria, padding: espaco.md, borderRadius: raio.sm, alignItems: 'center' },
  disabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '700' },
  exit: { textAlign: 'center', color: cores.textoSuave },
  error: { color: cores.erro },
});
