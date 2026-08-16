/**
 * Raiz do app.
 *
 * Sem sessão → tela de login.
 * Com sessão → abas Denunciar / Minhas denúncias.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import CameraScreen from './src/screens/CameraScreen';
import MapScreen from './src/screens/MapScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import { cores } from './src/theme';

const Tab = createBottomTabNavigator();

function Abas() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: cores.primaria,
        tabBarInactiveTintColor: cores.textoSuave,
        headerStyle: { backgroundColor: cores.fundo },
        headerTintColor: cores.textoClaro,
      }}
    >
      <Tab.Screen
        name="Denunciar"
        component={CameraScreen}
        options={{
          headerShown: false,
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📷</Text>,
        }}
      />
      <Tab.Screen
        name="Por perto"
        component={MapScreen}
        options={{
          headerShown: false,
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🗺️</Text>,
        }}
      />
      <Tab.Screen
        name="Minhas denúncias"
        component={HistoryScreen}
        options={{
          headerShown: false,
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📋</Text>,
        }}
      />
    </Tab.Navigator>
  );
}

function Raiz() {
  const { isAuthenticated, loading } = useAuth();
  const [demorando, setDemorando] = useState(false);

  // Depois de alguns segundos, explica o que está acontecendo. Tela parada
  // sem texto parece app travado — e foi exatamente essa a impressão antes
  // de existir tempo limite nas requisições.
  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setDemorando(true), 3000);
    return () => clearTimeout(t);
  }, [loading]);

  if (loading) {
    return (
      <View style={estilos.carregando}>
        <Image
          source={require('./assets/logo.png')}
          style={estilos.logo}
          resizeMode="contain"
        />
        <ActivityIndicator size="large" color="#fff" />
        {demorando && (
          <Text style={estilos.carregandoTexto}>
            Conectando ao servidor...{'\n'}
            Se demorar, verifique se o backend está rodando.
          </Text>
        )}
      </View>
    );
  }

  return isAuthenticated ? <Abas /> : <LoginScreen />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <Raiz />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const estilos = StyleSheet.create({
  carregando: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cores.fundo,
    padding: 24,
  },
  logo: {
    width: 200,
    height: 115,
    marginBottom: 28,
    // A logo é escura; sobre o fundo verde escuro precisa clarear.
    tintColor: '#ffffff',
  },
  carregandoTexto: {
    marginTop: 20,
    color: '#cbd5c8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
});
