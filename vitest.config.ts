import { defineConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default defineConfig({
  ...viteConfig({ mode: 'test', command: 'serve' }),
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
