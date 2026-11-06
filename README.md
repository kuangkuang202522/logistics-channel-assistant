# 物流渠道判断助手

马帮 FBA 货件页的 Tampermonkey 助手：自动识别物流渠道、美国 5 货件分组、加拿大分区、德英货代选择，并支持按“仓库 + 货代 + 渠道”自动勾选货件并生成发货单。

当前版本：**v1.3.3**

## 安装

1. 浏览器安装 [Tampermonkey（篡改猴）](https://www.tampermonkey.net/)。
2. 打开本仓库的 GitHub Pages 页面，或直接点击：
   `logistics-channel-assistant.user.js`
3. 在 Tampermonkey 安装页点“安装 / 更新”。

## iframe 设置（重要）

马帮 FBA 页的外层是 `www.mabangerp.com`，货件表格在 `amz1.mabangerp.com` 的 iframe 里。脚本必须在内层 iframe 运行。

- Tampermonkey 管理面板 → 物流渠道判断助手 → **设置** → **运行于 iframe** → 选 **所有 / All frames** → 保存 → 刷新页面。
- 或使用 Desktop 上的“一键导入_含iframe设置.zip”（已预置 `noframes:false`）。

## 自动更新

脚本头部包含：

```text
// @updateURL    https://raw.githubusercontent.com/kuangkuang202522/logistics-channel-assistant/main/logistics-channel-assistant.user.js
// @downloadURL  https://raw.githubusercontent.com/kuangkuang202522/logistics-channel-assistant/main/logistics-channel-assistant.user.js
```

Tampermonkey 会定期检查 `@updateURL`，发现 `@version` 变大就自动更新。

## 发布新版本

1. 修改 `logistics-channel-assistant.user.js`。
2. **必须把 `@version` 往上加**（例如 `1.3.3` → `1.3.4`）。
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
