import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.studyvisual.app',
  appName: 'studyvisual',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // Set this to your actual production Vercel URL
    url: 'https://studyvisual.vercel.app',
    cleartext: true
  }
};

export default config;
