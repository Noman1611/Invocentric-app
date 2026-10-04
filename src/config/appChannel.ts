/**
 * InvoCentric App Channel Configuration
 * Supports 'production' (official public app) and 'test' (internal beta/test app)
 */

export type AppChannel = 'production' | 'test';

export const APP_CHANNEL: AppChannel = 
  (import.meta.env.VITE_APP_CHANNEL as AppChannel) || 'production';

export const IS_TEST_BUILD = APP_CHANNEL === 'test';

export const TEST_RELEASE_TAG = 'test-channel';
export const TEST_APK_FILENAME = 'InvoCentric-Test.apk';
export const TEST_RELEASE_API_URL = 'https://api.github.com/repos/Noman1611/Invocentric-app/releases/tags/test-channel';
export const TEST_APK_DOWNLOAD_URL = 'https://github.com/Noman1611/Invocentric-app/releases/download/test-channel/InvoCentric-Test.apk';
