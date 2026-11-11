# 物流渠道判断助手

马帮 FBA 货件页的 Tampermonkey 助手：自动识别物流渠道、美国 5 货件分组、加拿大分区、德英货代选择，并支持按“仓库 + 货代 + 渠道”自动勾选货件并生成发货单。

默认约 0.5 秒快速识别；识别不全时，再点同一按钮做全量识别。

悬浮按钮只在马帮 FBA 货件页显示，切到其他页面会自动隐藏。

当前版本：**v1.5.0**

## 安装

1. 浏览器安装 [Tampermonkey（篡改猴）](https://www.tampermonkey.net/)。
2. 打开本仓库的 GitHub Pages 页面，或直接点击：
   `logistics-channel-assistant.user.js`
3. 在 Tampermonkey 安装页点“安装 / 更新”。

## v1.5.0 怎么用

1. **只在马帮 FBA 货件页显示**；切到库存、发货单、TB 等其他页面会自动隐藏。
2. 打开面板会自动**快速读取**当前页，通常约 0.5 秒。
3. 如果状态栏提示“识别不全”，按钮会变成 **“识别不全，点此全量识别”**，再点一次同一按钮即可。
4. 全量识别会展开并滚动表格，SKU 多时需要几秒；完成后按钮恢复“快速读取”。

### v1.5.0 两个新优化

**1. 美国海运 5 票组可以逐票改货代**

- 默认仍按“天盛票数/组 = 3”分配：天盛先占美东、再美西、最后美中，其余给“本周另一家”。
- 结果表里每一票的货代都变成下拉框，可以直接把某票改成天盛/瑞易达/铭运，改完立即生效。
- 5 票组优先按马帮批次号、其次按“货件名称”分组；都没有时把连续 5 票美国海运归一组，不再要求名称完全相同。
- 改“天盛票数/组”“本周另一家”或“美国按5个货件一组”时，会重置本组手工货代，按新设置重新分配。

**2. 美国空运默认天盛，可选瑞易达**

- 新增“美国空运货代”下拉：默认天盛，可切换瑞易达。
- 选天盛时，“美国空运货型”继续生效：普货=天翼提，药贴=天敏提。
- 选瑞易达时，渠道为“美国空运-CN”。
- 结果表里美国空运每一票也能单独改货代。

## iframe 设置（重要）

马帮 FBA 页的外层是 `www.mabangerp.com`，货件表格在 `amz1.mabangerp.com` 的 iframe 里。脚本必须在内层 iframe 运行。

- Tampermonkey 管理面板 → 物流渠道判断助手 → **设置** → **仅在顶层页面（框架）运行** → 选 **否**（英文：Run only in top frame → No）→ 保存 → 刷新页面。
- 如果找不到该选项：管理面板 → 设置 → 配置模式 → 高级，再回到脚本设置。

## 自动更新

脚本头部包含：

```text
// @updateURL    https://raw.githubusercontent.com/kuangkuang202522/logistics-channel-assistant/main/logistics-channel-assistant.user.js
// @downloadURL  https://raw.githubusercontent.com/kuangkuang202522/logistics-channel-assistant/main/logistics-channel-assistant.user.js
```

Tampermonkey 会定期检查 `@updateURL`，发现 `@version` 变大就自动更新。

## 发布新版本

1. 修改 `logistics-channel-assistant.user.js`。
2. **必须把 `@version` 往上加**（例如 `1.5.0` → `1.5.1`）。
3. 提交并推送到 `main` 分支。
4. 用户端 Tampermonkey 会在下次检查时自动更新；也可以手动点“检查更新”。

> 版本号不变，Tampermonkey 不会更新。

## 目录

```text
logistics-channel-assistant.user.js   # 脚本本体
index.html                            # GitHub Pages 安装页
.github/workflows/validate.yml        # 提交时做 JS 语法检查
```

## 注意

- 仓库需要是 **Public**，否则 raw 更新地址需要登录 token，Tampermonkey 无法自动更新。
- 脚本文件名保持英文 `logistics-channel-assistant.user.js`，避免中文 URL 编码问题；脚本显示名仍是“物流渠道判断助手”。
