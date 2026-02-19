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

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk: Buffer) => { body += chunk.toString() })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

function auditApiPlugin(): PluginOption {
  return {
    name: 'audit-api',
    configureServer(server) {
      let dbModule: Record<string, any> | null = null

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

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/seeds')) return next()

        res.setHeader('Content-Type', 'application/json')

        try {
          const db = await getDb()

          if (req.method === 'POST') {
            const raw = await readBody(req)
            const payload: unknown = JSON.parse(raw)
            const records = Array.isArray(payload) ? payload : [payload]

            db.bulkInsertVerifiedSeeds(records)
            res.statusCode = 201
            res.end(JSON.stringify({ success: true, count: records.length }))
          } else if (req.method === 'GET') {
            const url = new URL(req.url, `http://${req.headers.host}`)
            const limit = Math.min(
              Math.max(parseInt(url.searchParams.get('limit') || '50', 10), 1),
              10000
            )
            const rows = db.getRecentSeeds(limit)
            res.end(JSON.stringify(rows))
          } else {
            res.statusCode = 405
            res.end(JSON.stringify({ error: 'Method not allowed' }))
          }
        } catch (err: any) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: err.message }))
        }
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
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
