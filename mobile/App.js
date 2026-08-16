/**
 * Raiz do app.
 *
 * Sem sessão → tela de login.
 * Com sessão → abas Denunciar / Minhas denúncias.
 */
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import CameraScreen from './src/screens/CameraScreen';
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

  if (loading) {
    return (
      <View style={estilos.carregando}>
        <ActivityIndicator size="large" color="#fff" />
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
  },
});
