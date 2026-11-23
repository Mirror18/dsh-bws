# 更新记录

## 0.3.0 (2026-11-23)

- **钥匙文件**：建库时自动写 `~/.config/dsh-bws/key`（base64 32 字节，0600）；CLI 与服务优先用它，
  不需要口令、不再每次跑 scrypt。已建库的机器在面板里一键补写。
- **`dsh-bws key path | export | import`**：多机「甲方案」——搬钥匙文件而不是钥匙仓库；导入前先验证。
- **`POST /bws/credential/check`**：本机钥匙/口令是否真的能开库；过期文件会在面板里提示并允许覆盖保存。
- **`POST /bws/unlock {useKeyFile:true}`**：锁定态可「用本机钥匙解锁」，不再必须敲口令。
- **`POST /bws/keyfile/save`**：解锁后直接导出密钥，无需重新输入口令。
- 自动锁定：空闲 N 分钟（默认 15，可关）后服务端主动 `lock()`；面板每 30 秒探测并回到口令门。
- 文档：SERVICES 的 systemd 示例改用 `%h` 与钥匙文件；DEPLOY 第二台机器改为搬钥匙四步。

## 0.2.0 (2026-11-22)

- 从「bws 云端代理」改为**本地加密金库**：SQLite + AES-256-GCM，scrypt 派生密钥；
  明文只在一次调用内出现。
- git 多远端同步：仓库里只有密文与元数据；`meta/index.json` 带 `valueLength`。
- 多机：盐与验证锚随仓库同步；空库拉到远端时自动采纳远端盐并锁定，提示重新解锁。
- CLI：`list/groups/has/get/run/check/passwd/version`，`run` 支持 `--file`（物化 0600 临时文件）、
  `--require`、`--passphrase-cred`（systemd-creds）。
- Agent 工具：`bws_list` / `bws_run` / `bws_grant`，按 workspace 走授权。
- 面板：口令门、凭证、授权（以工作区为主）、同步四个视图。
