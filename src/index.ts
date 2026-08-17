/**
 * @dsh-external/dsh-odette-skin — Odette 冰雪梦幻主题（Host 侧）
 * 静态资源路由：把 assets/ 下的背景图以 /odette-skin/<name> 暴露给
 * Client 浏览器（背景图加载）。路由注册走 ctx.webServer，随插件卸载自动回收。
 */
import type { Context } from '@deepseek-ai/cordis'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, dirname, extname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

type WebRoute = {
  kind: 'prefix'
  path: string
  handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
}

type AppContext = Context & {
  webServer: { register(route: WebRoute): () => void }
}

export const name = '@dsh-external/dsh-odette-skin'
export const inject = ['webServer']

const ROUTE_PREFIX = '/odette-skin'
const ASSETS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'assets')

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
}

async function handleAssets(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' })
    res.end()
    return
  }
  let pathname: string
  try {
    pathname = new URL(req.url ?? '/', 'http://127.0.0.1').pathname
  } catch {
    res.writeHead(400)
    res.end('bad request')
    return
  }
  // 路由形如 /odette-skin/bg-dark.jpg → 取相对名
  let rel: string
  try {
    rel = decodeURIComponent(pathname.slice(ROUTE_PREFIX.length + 1))
  } catch {
    res.writeHead(400)
    res.end('bad path')
    return
  }
  // 防目录穿越：resolve 解析 .. 后必须仍位于 assets 内
  const target = resolve(ASSETS_DIR, rel)
  if (target !== ASSETS_DIR && !target.startsWith(ASSETS_DIR + sep)) {
    res.writeHead(403)
    res.end('forbidden')
    return
  }
  try {
    const data = await readFile(target)
    const mime = MIME[extname(target).toLowerCase()] ?? 'application/octet-stream'
    res.writeHead(200, {
      'content-type': mime,
      'content-length': String(data.length),
      'cache-control': 'public, max-age=300',
    })
    res.end(req.method === 'HEAD' ? undefined : data)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code === 'ENOENT' ? 404 : 500
    res.writeHead(code)
    res.end(code === 404 ? 'not found' : 'internal error')
  }
}

export function apply(ctx: AppContext): void {
  // 路由注册必须挂 ctx.effect：fiber dispose 时自动注销，热重载才不残留 duplicate route
  ctx.effect(
    () => ctx.webServer.register({ kind: 'prefix', path: ROUTE_PREFIX, handler: handleAssets }),
    name + ': assets route',
  )
  ctx.logger?.info?.('[' + name + '] assets route: ' + ROUTE_PREFIX + ' → ' + ASSETS_DIR)
}
