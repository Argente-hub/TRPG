# 无限流TRPG 跑团工具站

基于《无限流TRPG正式版 3.25》规则书(CHM)搭建的本地跑团工具站。纯前端应用,配合人类 ST 进行面团/语音团使用。

## 启动

```bash
npm install
npm run dev        # http://localhost:5173
```

开发/预览服务器只绑定本机回环 `127.0.0.1`(安全考虑:开发服务器不应对外暴露)。
同一局域网内的设备请使用下方公网部署地址访问;若确需临时局域网访问,
可临时把 `vite.config.ts` 的 `server.host` 改为 `true`,用完改回。

## 公网部署

**线上地址:https://argente-hub.github.io/TRPG/**(GitHub Pages,推送到 main 自动重新部署)

纯静态站点(HashRouter + 相对路径),`npm run build` 产物 `dist/`(约 47MB,含数据)
可部署到任意静态托管平台,任意域名/子路径直接可用。三种方式:

1. **Netlify Drop(最快,约 2 分钟,无需命令行)**
   打开 https://app.netlify.com/drop ,把 `dist/` 文件夹拖进去,立即获得
   `https://随机名.netlify.app` 公网地址;在 Site settings → Change site name 可改名为
   `https://<好记的名字>.netlify.app`。绑定自己的域名:Domain management → Add domain,按提示加 CNAME。

2. **GitHub Pages(推代码自动部署)**
   仓库已含 `.github/workflows/deploy.yml`:推送到 main 分支即自动构建并发布到
   `https://<用户名>.github.io/<仓库名>/`(仓库 Settings → Pages 确认 Source 为 GitHub Actions)。

3. **Vercel / Netlify CLI**
   `npx vercel` 或 `npx netlify deploy --prod --dir=dist`,按提示登录即可。

安全说明:站点为纯前端,无后端、无任何密钥;规则数据来自公开规则书;
玩家存档(localStorage)保存在各访问者自己的浏览器中,不上传服务器。

生产构建:

```bash
npm run build      # 产物在 dist/
npm run preview    # 本地预览生产构建
```

引擎单元测试(规则数值固化):

```bash
npm test
```

## 功能

| 页面 | 功能 |
| --- | --- |
| 首页 | 角色管理、创建、JSON 导入/导出(localStorage 存档) |
| 建卡向导 | 按规则书六段流程建卡:概念 → 属性(3/2/1系+6自由,4→5耗2) → 技能(6/5/4+5自由,免费专业) → 专长(15点,特殊身份解锁战斗专长) → 缺陷/天赋(2:1) → 怪癖与XP(≤5个,每个+2XP) |
| 角色卡 | 属性/传奇属性、技能与专业、专长缺陷天赋、装备槽(16槽位)、能量池、效果注记(自定义加值) |
| 骰子 | D10 骰池检定:8/9/10成功、10/9/8加骰、附加成功、机运骰、未受训惩罚、竞争/对抗DC、意志力+3DP完美 |
| 战斗追踪 | 先攻排序(1D10+先攻值)、伤势四级(完好/B/L/A,溢出2B→1L→2L→1A)、减伤链(硬度/DR/能量抗力/吸收/阈值)、多次攻击减值(格挡→闪避→基础)、不良状态点数与三级门槛 |
| 轮回之境 | 支线D/C/B/A/S账本(3低↔1高拆合)、分数、XP、固定通关奖励(第n场⌈n/2⌉D+1000分) |
| 资料库 | 全量 1593 条资源(血统/改造/瞳术/称号/流派/典籍/技艺/物品/法术/修炼体系/随从,含 119 个技能树子技能),搜索/筛选/详情/一键挂载;子技能与技能树可"购买并挂载"(自动校验并扣减支线/分数并记录流水) |
| 规则书 | 内置 58 章规则书阅读器 |

## 数据管线

数据由 Python 脚本从 CHM 解包的 HTML 生成(产出已提交在 `public/data/`,改数据才需要重跑):

```bash
# 在上级目录 D:\Users\22967\Desktop\无限\ 执行:
python extract_rules.py        # 规则部分 58 章 → 规则部分_无限流TRPG3.25/*.md
python extract_resources.py    # 资源部分 1474 条 → public/data/resources/
python parse_curated.py        # 专长/缺陷/怪癖/天赋 → public/data/curated/
python split_skill_trees.py    # 技艺类技能树拆分为 119 个可单独购买的子技能条目
```

依赖:Python 3 + lxml,源 CHM 由 7-Zip 解包到 `chm_extract_325/`。

## 项目结构

```
src/
├── engine/        # 纯 TS 规则引擎(可单测,无 UI 依赖)
│   ├── dice.ts        # 骰池/加骰/机运骰
│   ├── math.ts        # 传奇属性/乘除合并
│   ├── bonus.ts       # 加值类型叠加/防御槽位/多次攻击减值
│   ├── character.ts   # 建卡/衍生属性/体型
│   ├── combat.ts      # 攻击结算/减伤链/伤势填充
│   ├── conditions.ts  # 不良状态点数与门槛
│   ├── energy.ts      # 能量池/施法
│   └── economy.ts     # 支线/分数/XP/价格表
├── pages/         # 七大页面
├── store/         # zustand 持久化(角色/战斗)
├── lib/data.ts    # 数据懒加载
└── data → public/data/  # 规则书 md / 资源库 JSON / 建卡数据
```

## 规则边界说明

- 资源条目(血统/改造等)为原文全文 + 元数据(等级/价格/本质自动识别),具体数值效果通过角色卡的「效果注记/自定义加值」手工录入后参与骰子与战斗结算——原书条目格式异构,无法可靠地全自动结构化。
- 减伤链 v1 实现核心步骤(免疫→硬度→DR→能量抗力→吸收→阈值→易伤);复杂特殊能力(破甲/高速/易伤的完整规则)按注记由 ST 把关。
- 所有规则争议以 ST 裁定为准(房规优先)。
