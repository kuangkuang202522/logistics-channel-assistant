# 物流渠道判断助手

马帮 FBA 货件页悬浮物流渠道判断工具。自动读取当前页货件，按美国 5 货件分组、加拿大分区、德英货代规则判断渠道；结果按货代分组展示。

## 安装

1. 浏览器安装 Tampermonkey（篡改猴）。
2. 打开 [logistics-channel-assistant.user.js](./logistics-channel-assistant.user.js)，按 Tampermonkey 提示安装。
3. 打开马帮 FBA 货件页，右下角出现「物流渠道」按钮。

## v1.5.1

在 v1.5.0 基础上只加界面分组，不删除已有能力：

- 结果按货代分组：天盛 / 瑞易达 / 铭运 / 待分配 / 待定
- 每组独立卡片，带彩色左边条、徽章、票数
- 顶部汇总 chips
- 货件号加粗、等宽字体、按货代配色
- 生成发货单表按货代排序、加货代分隔行
- 面板加宽、样式优化

保留的 v1.5.0 / v1.4.x 能力：

- 美国海运 5 票组支持逐票改货代（3 票天盛 + 2 票其他）
- 美国空运默认天盛，可选瑞易达
- 默认 0.5 秒快速识别，识别不全时同一按钮手动切换全量识别
- 只在 FBA 货件页显示，切到其他页面自动隐藏
- IMO1 / ITX3 / ICA3 特例仓天盛海运固定盛森提
- 运输方式读取子 SKU 行 `printRemark`
- 方式列可反复修改，选「自动」恢复自动识别

## 文件

| 文件 | 用途 |
| --- | --- |
| `index.html` | GitHub Pages 网页版 |
| `logistics-channel-assistant.user.js` | 篡改猴脚本（自动更新） |
| `validate.yml` | 语法检查配置 |
| `.nojekyll` | GitHub Pages 关闭 Jekyll |
| `README.md` | 本文件 |

## 更新

把 `@version` 往上加（如 `1.5.2`），提交脚本；Tampermonkey 会按 `@updateURL` 自动检查更新。

> 如果仓库名不是 `logistics-channel-assistant` 或分支不是 `main`，同步修改脚本顶部的 `@updateURL` / `@downloadURL`。
