import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'Smooth Migration',
  webDir: 'www',
  android: {
      allowMixedContent: true,
  },
  server: {
      androidScheme: 'http',
      cleartext: true,
  }
};

export default config;
