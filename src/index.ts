/**
 * dsh-odette-skin — Odette 冰雪梦幻主题（Host 侧）
 * v0.3：素材以 data URI 内嵌于 client bundle（scripts/generate-art.cjs 生成），
 * 激活不再依赖任何静态资源路由/远程 URL；host 侧因此无运行时行为。
 * （机制对齐 maid-atelier：host 空实现，全部展示逻辑在 client 侧）
 */
export const name = 'dsh-odette-skin'

/** 无 host 侧行为。 */
export function apply(): void {}
