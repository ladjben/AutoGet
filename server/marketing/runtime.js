import { config } from './config.js'
import { databases } from './db.js'
import { metaClient } from './meta.js'
import { createApp } from './index.js'
let runtime

// Reuse pools in warm invocations, without starting a listener or an endless loop.
export function getRuntime() {
  if (!runtime) {
    const cfg = config()
    const { db, erp } = databases(cfg)
    runtime = { app: createApp(cfg, db, erp, metaClient(cfg)) }
  }
  return runtime
}
