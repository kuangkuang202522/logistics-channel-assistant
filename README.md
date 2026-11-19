# 物流渠道判断助手

马帮 / Teambition 页面悬浮物流渠道判断助手。

当前版本：**v1.5.2**（基于 v1.5.1，保留美国 5 票分组、逐票改货代、结果按货代分组等功能）

## v1.5.2 更新

- 德国卡航统一选择 `欧洲卡航-递延（不包税）`
- 英国卡航统一选择 `英国卡航-递延（不包税）`
- 兼容旧结果：
  - `欧洲卡航-包税` → `欧洲卡航-递延（不包税）`
  - `中欧卡航包税` → `欧洲卡航-递延（不包税）`
  - `英国卡航VAT` → `英国卡航-递延（不包税）`

## 安装 / 更新

已安装 v1.5.1 的用户不需要手动重装：

1. 打开 Tampermonkey 管理面板；
2. 找到「物流渠道判断助手」；
3. 点「检查更新」，或等待自动更新；
4. 确认版本变为 `1.5.2` 后刷新马帮 FBA 货件页。

新安装：

```text
https://raw.githubusercontent.com/kuangkuang202522/logistics-channel-assistant/main/logistics-channel-assistant.user.js
```

在已安装 Tampermonkey 的浏览器中打开上面的 raw 地址，点「安装」即可。

## 文件说明

- `logistics-channel-assistant.user.js`：Tampermonkey 脚本（GitHub 自动更新源）
- `index.html`：GitHub Pages 安装页
- `.nojekyll`：GitHub Pages 配置
- `.github/workflows/validate.yml`：每次推送自动做 JS 语法检查

## 维护

修改脚本后：

1. 更新 `@version`；
2. 提交并推送 `logistics-channel-assistant.user.js`；
3. GitHub Pages / raw 地址会自动指向新版本；
4. 已安装用户下次「检查更新」即可升级。
