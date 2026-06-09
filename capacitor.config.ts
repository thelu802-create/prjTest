import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.memorycloud.app',
  appName: 'Memory Cloud',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
    hostname: 'localhost',
    allowNavigation: [
      'login.microsoftonline.com',
      '*.login.microsoftonline.com',
      'login.live.com',
      '*.login.live.com',
      '*.msauth.net',
      '*.microsoft.com',
    ],
  },
};

export default config;
