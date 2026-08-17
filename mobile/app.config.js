const beta = process.env.APP_VARIANT === 'beta';

module.exports = {
  expo: {
    name: beta ? 'Lixo na Rua Beta' : 'Lixo na Rua',
    slug: 'lixo-na-rua',
    version: '1.0.0',
    orientation: 'portrait',
    userInterfaceStyle: 'light',
    icon: './assets/icon.png',
    splash: { image: './assets/splash.png', resizeMode: 'contain', backgroundColor: '#f8faf7' },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.lixonarua.app',
      infoPlist: {
        NSCameraUsageDescription: 'O Lixo na Rua usa a câmera para você fotografar o lixo que quer denunciar.',
        NSLocationWhenInUseUsageDescription: 'A localização marca no mapa onde o lixo foi encontrado.',
      },
    },
    android: {
      package: 'com.lixonarua.app',
      permissions: ['CAMERA', 'ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION'],
      adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#7caf2e' },
      config: { googleMaps: { apiKey: 'AIzaSyANWYn2EC9oZGToBwP4FkmusZJokZQMJPE' } },
    },
    extra: {
      apiUrl: beta
        ? process.env.BETA_API_URL || 'https://api-teste-lixo.brconsultorias.com'
        : 'https://api-lixo.brconsultorias.com',
      beta,
      eas: { projectId: '65174b9e-84c9-4c21-b261-595892d1ebe7' },
    },
    plugins: [
      ['expo-camera', { cameraPermission: 'O Lixo na Rua usa a câmera para você fotografar o lixo que quer denunciar.' }],
      ['expo-location', { locationWhenInUsePermission: 'A localização marca no mapa onde o lixo foi encontrado.' }],
    ],
  },
};
