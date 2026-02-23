import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, PluginOption } from "vite";
import type { IncomingMessage } from "http";

import sparkPlugin from "@github/spark/spark-vite-plugin";
import createIconImportProxy from "@github/spark/vitePhosphorIconProxyPlugin";
import { resolve } from 'path'

const projectRoot = process.env.PROJECT_ROOT || import.meta.dirname

// ---------------------------------------------------------------------------
// Audit API plugin – serves /api/seeds during development
// Uses Vite's ssrLoadModule to load the database module at runtime.
// ---------------------------------------------------------------------------

function auditApiPlugin(): PluginOption {
  return {
    name: 'audit-api',
    configureServer(server) {
      let dbModule: Record<string, any> | null = null
      let seedsApiModule: Record<string, any> | null = null

      async function getDb() {
        if (!dbModule) {
          dbModule = await server.ssrLoadModule('/src/db/db.ts')
        }
        return dbModule as {
          insertVerifiedSeed: (record: any) => void
          getRecentSeeds: (limit: number) => any[]
          bulkInsertVerifiedSeeds: (records: any[]) => void
        }
      }

      async function getSeedsApi() {
        if (!seedsApiModule) {
          seedsApiModule = await server.ssrLoadModule('/src/server/api/seeds.ts')
        }
        return seedsApiModule as {
          handleSeedsApiRequest: (args: {
            req: IncomingMessage
            res: any
            db: {
              bulkInsertVerifiedSeeds: (records: any[]) => void
              getRecentSeeds: (limit: number) => any[]
            }
          }) => Promise<void>
        }
      }

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/seeds')) return next()

        try {
          const db = await getDb()
          const seedsApi = await getSeedsApi()
          await seedsApi.handleSeedsApiRequest({ req, res, db })
        } catch (err: any) {
          res.setHeader('Content-Type', 'application/json')
          res.statusCode = 500
          res.end(JSON.stringify({ error: err.message }))
        }
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [
    react(),
    tailwindcss(),
    // DO NOT REMOVE
    createIconImportProxy() as PluginOption,
    sparkPlugin() as PluginOption,
    auditApiPlugin(),
  ],
  resolve: {
    alias: {
      '@': resolve(projectRoot, 'src')
    }
  },
  ssr: {
    external: ['better-sqlite3']
  },
  server: {
    headers: {
      // Required for SharedArrayBuffer support in Web Workers
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    }
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-radix': [
            '@radix-ui/react-accordion',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
          ],
          'vendor-crypto': ['crypto-js', 'ethers'],
          'vendor-charts': ['recharts', 'd3'],
          'vendor-animation': ['framer-motion', 'three'],
        },
      },
    },
  },
});
