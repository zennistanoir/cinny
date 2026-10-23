import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { wasm } from '@rollup/plugin-wasm';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill';
import inject from '@rollup/plugin-inject';
import topLevelAwait from 'vite-plugin-top-level-await';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';
import path from 'path';
import buildConfig from './build.config';
import { patchElementCall } from './scripts/patchElementCall.js';

const copyFiles = {
  targets: [
    {
      src: 'node_modules/@element-hq/element-call-embedded/dist/!(index.html)',
      dest: 'public/element-call',
    },
    {
      // Let the host patch getUserMedia (RNNoise) before Element Call's bundle runs.
      // See src/app/plugins/call/noiseSuppression.ts.
      src: 'node_modules/@element-hq/element-call-embedded/dist/index.html',
      dest: 'public/element-call',
      transform: (content) =>
        content.replace(
          '<meta charset="UTF-8">',
          '<meta charset="UTF-8"><script>try{parent.__zennithPatchMedia&&parent.__zennithPatchMedia(window)}catch(e){}</script>'
        ),
    },
    {
      src: [
        'node_modules/@sapphi-red/web-noise-suppressor/dist/rnnoise.wasm',
        'node_modules/@sapphi-red/web-noise-suppressor/dist/rnnoise_simd.wasm',
      ],
      dest: 'public/rnnoise',
    },
    {
      src: 'node_modules/@sapphi-red/web-noise-suppressor/dist/rnnoise/workletProcessor.js',
      dest: 'public/rnnoise',
      rename: 'rnnoiseWorklet.js',
    },
    {
      src: 'node_modules/@sapphi-red/web-noise-suppressor/dist/noiseGate/workletProcessor.js',
      dest: 'public/rnnoise',
      rename: 'noiseGateWorklet.js',
    },
    {
      src: 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
      dest: '',
      rename: 'pdf.worker.min.js',
    },
    {
      src: 'netlify.toml',
      dest: '',
    },
    {
      src: 'config.json',
      dest: '',
    },
    {
      src: 'public/manifest.json',
      dest: '',
    },
    {
      src: 'public/res/android',
      dest: 'public/',
    },
    {
      src: 'public/favicon.ico',
      dest: 'public/',
    },
    {
      src: 'public/res/apple',
      dest: 'public/res/',
    },
    {
      src: 'public/locales',
      dest: 'public/',
    },
  ],
};

function serverMatrixSdkCryptoWasm(wasmFilePath) {
  return {
    name: 'vite-plugin-serve-matrix-sdk-crypto-wasm',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === wasmFilePath) {
          const resolvedPath = path.join(
            path.resolve(),
            '/node_modules/@matrix-org/matrix-sdk-crypto-wasm/pkg/matrix_sdk_crypto_wasm_bg.wasm'
          );

          if (fs.existsSync(resolvedPath)) {
            res.setHeader('Content-Type', 'application/wasm');
            res.setHeader('Cache-Control', 'no-cache');

            const fileStream = fs.createReadStream(resolvedPath);
            fileStream.pipe(res);
          } else {
            res.writeHead(404);
            res.end('File not found');
          }
        } else {
          next();
        }
      });
    },
  };
}

export default defineConfig({
  appType: 'spa',
  publicDir: false,
  base: buildConfig.base,
  server: {
    port: 8080,
    host: true,
    fs: {
      // Allow serving files from one level up to the project root
      allow: ['..'],
    },
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  plugins: [
    serverMatrixSdkCryptoWasm('/node_modules/.vite/deps/pkg/matrix_sdk_crypto_wasm_bg.wasm'),
    topLevelAwait({
      // The export name of top-level await promise for each chunk module
      promiseExportName: '__tla',
      // The function to generate import names of top-level await promise in each chunk module
      promiseImportName: (i) => `__tla_${i}`,
    }),
    viteStaticCopy(copyFiles),
    // Must follow viteStaticCopy: patches the Element Call bundle it copied.
    patchElementCall('dist'),
    vanillaExtractPlugin(),
    wasm(),
    react(),
    VitePWA({
      srcDir: 'src',
      filename: 'sw.ts',
      strategies: 'injectManifest',
      injectRegister: false,
      manifest: false,
      injectManifest: {
        injectionPoint: undefined,
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
      plugins: [
        // Enable esbuild polyfill plugins
        NodeGlobalsPolyfillPlugin({
          process: false,
          buffer: true,
        }),
      ],
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false, // Disabled to prevent Node.js memory crashes on massive bundle sizes
    copyPublicDir: false,
    rollupOptions: {
      plugins: [inject({ Buffer: ['buffer', 'Buffer'] })],
    },
  },
});
