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
  base: process.env.GITHUB_ACTIONS ? '/originals-fairness-i/' : '/',
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
});
