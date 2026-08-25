import { readFile } from 'node:fs/promises'
import { resolve as resolvePath, dirname, basename } from 'node:path'
import type { UserConfig } from 'tsdown'
import { transform } from 'lightningcss'

const PLUGIN_ID = "dsh-odette-skin"

const CLIENT_EXTERNALS = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client',
  'cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-runtime/client',
]

/**
 * 虚拟 id 包装：让皮肤 CSS 绕开 tsdown 自带 css 管线（那需要 @tsdown/css），
 * 改由 lightningcss 在 bundle 内编译。机制对齐 maid-atelier 的 dsh-css-modules-inline：
 * 样式文本打进 client.js，工厂执行时注入 <style data-plugin> 标签，
 * 插件卸载时由 dsh loader 按 data-plugin 归属统一清理。
 * 注意后缀：tsdown 的守卫匹配以 .css 结尾的 id，虚拟 id 不能以 .css 结尾。
 */
const CSS_VIRTUAL_PREFIX = '\0dsh-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'

function odetteCssInline() {
  const cssFiles = new Map<string, string>()
  return {
    name: 'odette-css-inline',
    resolveId(source: string, importer: string | undefined) {
      if (!source.endsWith('.css')) return null
      const abs = importer !== undefined
        ? resolvePath(dirname(importer), source)
        : source
      const virtualId = CSS_VIRTUAL_PREFIX + abs + CSS_VIRTUAL_SUFFIX
      cssFiles.set(virtualId, abs)
      return virtualId
    },
    async load(virtualId: string) {
      if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
      const fileId = cssFiles.get(virtualId)
        ?? virtualId.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
      // 让物理样式表进入 watch 图，改 css 能触发热重建
      this.addWatchFile(fileId)
      const source = await readFile(fileId)
      const { code } = transform({
        filename: fileId,
        code: source,
        minify: true,
      })
      const tagId = `${PLUGIN_ID}/${basename(fileId)}`
      // 一个样式文件一个 <style data-plugin> 标签；重复执行幂等
      return [
        `const css = ${JSON.stringify(code.toString())};`,
        `const tagId = ${JSON.stringify(tagId)};`,
        "if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']') === null) {",
        "  const tag = document.createElement('style');",
        `  tag.dataset.plugin = ${JSON.stringify(PLUGIN_ID)};`,
        '  tag.dataset.pluginCss = tagId;',
        '  tag.textContent = css;',
        '  document.head.appendChild(tag);',
        '}',
        'export default {};',
      ].join('\n')
    },
  }
}

const clientBundle: UserConfig = {
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  dts: false,
  sourcemap: true,
  clean: false,
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
  },
  deps: {
    neverBundle: [...CLIENT_EXTERNALS],
    alwaysBundle: (id: string) => !CLIENT_EXTERNALS.includes(id),
  },
  plugins: [odetteCssInline()],
  outputOptions: {
    entryFileNames: 'client.js',
    banner: 'window.__ModuleLoader__.load({ id: ' + JSON.stringify(PLUGIN_ID) + ', factory: (require) => {',
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
    codeSplitting: false,
  },
}

export default [clientBundle] satisfies UserConfig[]
