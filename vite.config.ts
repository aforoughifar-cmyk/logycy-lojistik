import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    define: {
      // Polyfill process.env.API_KEY for the client-side code
      // We check for both VITE_API_KEY and API_KEY to be forgiving
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY || env.API_KEY)
    },
    resolve: {
      alias: {
        // Ensure imports work smoothly
      },
    },
  }
})