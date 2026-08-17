# dsh-odette-skin

Odette 冰雪梦幻主题 —— DSH 客户端的深/浅双模式 UI 美化皮肤。

> 仓库：https://github.com/lkdx0220/Genshin-odette-skin-dsh
> 主题：Genshin / Odette 同人

背景图 + 13 个官方主题 token 覆盖（半透明毛玻璃）+ 侧栏 Q 版小兽点缀，
内置皮肤开关（侧栏浮层小兽 / footer ❄ 按钮），离线本地资源，重启保留。

## 功能

- **深/浅双模式**：自动跟随客户端主题切换（深色=蓝白梦幻双人图，浅色=Vader 浅蓝白角色图）
- **主题 token 覆盖**：背景、层级、边框、品牌色、文字、状态色的蓝紫冰雪调
- **毛玻璃质感**：半透明面板 + body 背景图透出（`body::before` 伪元素层 + CSS filter 增强浅色对比度）
- **皮肤开关**：左下角浮层小兽（窄栏）或侧栏 footer ❄ 按钮（宽栏），点击即开关；皮肤关闭时入口以灰度+呼吸动画常驻，不会锁死
- **滚动条/选区美化**：蓝紫半透明滚动条 + 柔和文字选中色

## 安装

### 快速开始（npm registry，推荐）

```bash
# <name> 替换为你的 profile 名（如 web / demo）；未安装 dsh CLI 时用 npx @deepseek-ai/dsh 前缀
dsh plugin --profile <name> add dsh-odette-skin
# 例：npx @deepseek-ai/dsh plugin --profile web add dsh-odette-skin
```

已发布到 npm，包含预构建产物（`lib/` + `assets/` + `cordis.patch.yml`），无需构建授权。

### 方式一：注入器（本地开发，dsh-super-injector 环境）

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
  "dependencies": { "dsh-odette-skin": "link:<本目录绝对路径>" },
  "bundles": ["dsh-odette-skin"]
}
```

3. profile 的 `cordis.patch.yml` 追加：

```yaml
- insert:
    - id: odette-skin
      name: 'dsh-odette-skin'
```

4. `node_modules` 建 junction 链接后重启客户端。

### 方式三：tarball 安装（推荐分发，无需构建授权）

```bash
dsh plugin --profile <name> add ./dsh-odette-skin-0.0.1.tgz
```

构建产物已打包（`lib/` + `assets/` + `cordis.patch.yml`），安装即用。
（也可以直接从 GitHub Release 下载附件：`https://github.com/lkdx0220/Genshin-odette-skin-dsh/releases`）

### 方式四：从 GitHub 直接安装（源码 + prepare 自动构建）

```bash
dsh plugin --profile <name> add github:lkdx0220/Genshin-odette-skin-dsh
```

git 安装拉取的是源码，安装时由 `prepare` 脚本自动构建（自包含，无需 DSH_CHECKOUT）。
⚠️ pnpm ≥10 首次安装会被安全策略拦截——将以下内容加入该 profile 的 `pnpm-workspace.yaml` 授权构建：

```yaml
allowBuilds:
  'dsh-odette-skin': true
```

然后重新执行 `add`。若不想授权构建，改用方式三的 tarball 安装（无需任何构建授权）。

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
| 浅色背景 | **pixiv：Vader** · 画师 ID `86110838` · 作品 PID `147886966` | ![浅色背景](https://raw.githubusercontent.com/lkdx0220/Genshin-odette-skin-dsh/ad9f0a56d7f0292708e505935ff51f54f37d16bb/assets/bg-light.jpg) |
| 深色背景 | 游戏内截图（无版权问题） | ![深色背景](https://raw.githubusercontent.com/lkdx0220/Genshin-odette-skin-dsh/ad9f0a56d7f0292708e505935ff51f54f37d16bb/assets/bg-dark.jpg) |
| 侧栏小兽 | **B站 up 主：甘乐能** | ![侧栏小兽](https://raw.githubusercontent.com/lkdx0220/Genshin-odette-skin-dsh/ad9f0a56d7f0292708e505935ff51f54f37d16bb/assets/deco-sidebar.jpg) |

> 图片链接锁定 commit SHA（`ad9f0a5`），避免 raw CDN 对 `main` 分支路径的缓存返回旧图；
> 以后更新图片后，把链接中的 SHA 替换为最新 commit 即可。

## 免责声明 / Disclaimer

本项目为粉丝同人作品，与米哈游、HoYoverse、DeepSeek 无任何关联，也未获得官方授权。仅用于技术学习与个人使用。如侵权请联系我删除。

This project is a fan-made work. It is not affiliated with or endorsed by miHoYo, HoYoverse, or DeepSeek, and has not received any official authorization. It is intended for technical learning and personal use only. If any content infringes on your rights, please contact me and it will be removed.

## License

BSD-3-Clause（代码）；配图版权归原作者所有。
