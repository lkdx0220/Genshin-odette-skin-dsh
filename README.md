# @dsh-external/dsh-odette-skin

Odette 冰雪梦幻主题 —— DSH 客户端的深/浅双模式 UI 美化皮肤。

> 仓库：https://github.com/lkdx0220/Genshin-odette-skin-dsh
> 主题：Genshin / Odette 同人

背景图 + 13 个官方主题 token 覆盖（半透明毛玻璃）+ 侧栏 Q 版小兽点缀，
内置皮肤开关（侧栏浮层小兽 / footer ❄ 按钮），离线本地资源，重启保留。

## 功能

- **深/浅双模式**：自动跟随客户端主题切换（深色=芭蕾舞台冷调图，浅色=冰雪少女图）
- **主题 token 覆盖**：背景、层级、边框、品牌色、文字、状态色的蓝紫冰雪调
- **毛玻璃质感**：半透明面板 + body 背景图透出（`body::before` 伪元素层 + CSS filter 增强浅色对比度）
- **皮肤开关**：左下角浮层小兽（窄栏）或侧栏 footer ❄ 按钮（宽栏），点击即开关；皮肤关闭时入口以灰度+呼吸动画常驻，不会锁死
- **滚动条/选区美化**：蓝紫半透明滚动条 + 柔和文字选中色

## 安装

### 方式一：注入器（推荐，dsh-super-injector 环境）

```bash
dev_install_package C:\path\to\odette-skin      # 热装配到当前 profile
# 或运行时注入（不写 profile 配置）
dev_inject_plugin C:\path\to\odette-skin
```

### 方式二：手动装配（bundle 插件）

1. 构建产物（见下）
2. 在目标 profile 的 `package.json` 添加依赖与 `bundles` 条目：

```jsonc
// <profile>/package.json
{
  "dependencies": { "@dsh-external/dsh-odette-skin": "link:<本目录绝对路径>" },
  "bundles": ["@dsh-external/dsh-odette-skin"]
}
```

3. profile 的 `cordis.patch.yml` 追加：

```yaml
- insert:
    - id: odette-skin
      name: '@dsh-external/dsh-odette-skin'
```

4. `node_modules` 建 junction 链接后重启客户端。

## 构建

自包含构建（无需 DSH_CHECKOUT / bash，跨平台）：

```bash
npm install
npm run build   # host: 本地 tsc → lib/index.js；client: tsdown → lib/client.js
```

`prepare` 脚本已声明，从 GitHub/npm 安装时会自动构建。

产物：`lib/`（host + client）+ `assets/`（背景图/小兽图）。

## 使用

- 皮肤开关：点击左下角小兽或侧栏 footer 的 ❄ 按钮
- 状态持久化于 `localStorage['dsh-odette-skin:enabled']`
- 窄栏（rail）状态：小兽自动居中上移，❄ 按钮隐藏，仅留小兽入口

## 目录结构

```
src/index.ts          # host：/odette-skin 静态资源路由（防路径穿越 + MIME + 缓存头）
src/client/index.ts   # client：token 覆盖 / 背景图 / 开关与浮层组件 / CSS
assets/               # 背景图与点缀图（本地资源，无需网络）
cordis.patch.yml      # bundle 层插件行
```

## 图片来源与授权

配图版权归原作者所有，仅限个人使用；公开传播请遵守原作者授权条款。

| 用途 | 作者 | 图 |
|---|---|---|
| 浅色背景 | **pixiv：Vader** · 画师 ID `86110838` · 作品 PID `147886966` | ![浅色背景](assets/bg-light.jpg) |
| 深色背景 | （来源待补充） | ![深色背景](assets/bg-dark.jpg) |
| 侧栏小兽 | **B站 up 主：甘乐能** | ![侧栏小兽](assets/deco-sidebar.jpg) |

## License

BSD-3-Clause（代码）；配图版权归原作者所有。
