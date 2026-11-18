# 物流渠道判断助手

马帮 FBA 货件页悬浮物流渠道判断工具。自动读取当前页货件，按美国 5 货件分组、加拿大分区、德英货代规则判断渠道；结果按货代分组展示。

## 安装

1. 浏览器安装 Tampermonkey（篡改猴）。
2. 打开 [logistics-channel-assistant.user.js](./logistics-channel-assistant.user.js)，按 Tampermonkey 提示安装。
3. 打开马帮 FBA 货件页，右下角出现「物流渠道」按钮。

## v1.3.0

- 结果按货代分组：天盛 / 瑞易达 / 铭运 / 待分配 / 待定
- 每组独立卡片，带彩色左边条、徽章、票数
- 顶部汇总 chips
- 货件号加粗、等宽字体、按货代配色
- 生成发货单表按货代排序
- 面板加宽、样式优化

## 文件

| 文件 | 用途 |
| --- | --- |
| `index.html` | GitHub Pages 网页版 |
| `logistics-channel-assistant.user.js` | 篡改猴脚本（自动更新） |
| `validate.yml` | GitHub Actions 语法检查 |
| `.nojekyll` | GitHub Pages 关闭 Jekyll |
| `README.md` | 本文件 |

## 更新

把 `@version` 往上加（如 `1.3.1`），提交脚本；Tampermonkey 会按 `@updateURL` 自动检查更新。

> 如果仓库名不是 `logistics-channel-assistant` 或分支不是 `main`，同步修改脚本顶部的 `@updateURL` / `@downloadURL`。
