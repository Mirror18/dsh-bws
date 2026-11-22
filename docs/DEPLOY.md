# 部署到一台新机器

目标：新机器上跑起 DSH，装上 dsh-bws，用口令打开金库，从远端拉回密文索引，并让本机服务能取到凭证。

## 0. 前提

| 依赖 | 版本 | 检查 |
|---|---|---|
| Node | ≥ 24.9（要 `node:sqlite`） | `node -v` |
| git | 任意 | `git --version` |
| DSH | 已装、web 能起 | `dsh web` |

不需要 `bws`、不需要 `age`、不需要 sqlite3 CLI。

## 1. 装插件

插件目录（源码或发布包）放到本机，例如 `~/src/dsh-bws`，然后：

```bash
# 开发/链接方式
plugin_manager install_bundle target=link:$HOME/src/dsh-bws
# 或打包方式：把目录打成 tgz，target 指向 tgz
```

装完必须重启一次 web（Host 侧模块只在启动时加载）：

```bash
systemctl --user restart dsh-web     # 或你用的启动方式
```

自检：

```bash
curl -s http://127.0.0.1:3080/bws/status
# {"ok":true,"initialized":false,"locked":true,...,"version":2}
```

## 2. 建库 + 设口令

设置 → 内置插件 → **凭证金库** → 输入口令两次 → 创建金库。

- 口令 ≥ 8 字符，只用于 `scrypt(N=32768,r=8,p=1)` 派生密钥。创建时会自动写一份到
  `~/.config/dsh-bws/passphrase`（0600），让 systemd 服务与终端命令能免交互解锁；
  不想要这份副本就 `rm` 掉，改成每次手动解锁。
- 建库会在 `~/.dsh/dsh-bws/` 生成 `vault.db` 与空的 `repo/` git 仓库。
- 口令丢了没有找回通道；请自己留在密码管理器里（这是唯一需要人记的东西）。

## 3. 配远端（GitHub + Gitee）

先在两边各建一个**私有**空仓库（不要勾 README），然后面板「同步」页填：

```
GitHub  origin  https://github.com/<you>/dsh-vault.git
Gitee   gitee   https://gitee.com/<you>/dsh-vault.git
```

推送用的是本机 git 凭据：

```bash
# GitHub：gh 已登录时最省事
gh auth setup-git
# 或任意 https 凭据
git config --global credential.helper store
```

> SSH 远端在这台机器上走不通（`ssh -T git@github.com` 被代理重置），用 https。

保存远端 → 推送。之后每台机器都是：建库 → 解锁 → 拉取（首次拉取会把远端密文与索引合进来）。

## 4. 迁入现有凭证

新机器通常从旧机器推上去的仓库拉取即可，不需要导入。若要从 Bitwarden 一次性搬：

```bash
export BWS_ACCESS_TOKEN=...        # 或放 ~/.config/bws/access-token
# 面板「同步」页 → 从 bws 迁移
```

迁移只复制 键名 + 值 + 备注。`inferGroup()` 只会把键落到**你已经建好的同名分组**，没建就统一落到你在迁移对话框里选的那个分组（所以迁移前必须先建组）；键名不合 `^[A-Z][A-Z0-9_]*$` 的会跳过并计数。

## 5. 让本机服务取到凭证

服务进程需要非交互取值，三种方式，按安全强度排序：

**A. 由 dsh-web 解锁后，服务从面板取（最干净，但依赖 dsh-web 先起）**

暂时只能人工在面板里取值。等 `bws-secrets` skill 与工具上线后，agent 也能取。

**B. 口令文件 + `dsh-bws run`（可自动化；建库时已自动写好，见 `docs/SERVICES.md`）**

```bash
install -m 600 /dev/null ~/.config/dsh-bws/pass
# 把你的口令写进去（一行），不要有空行
```

systemd unit：

```ini
[Service]
Environment=DSH_BWS_DATA_DIR=%h/.dsh/dsh-bws
ExecStart=/usr/bin/env node %h/src/dsh-bws/bin/dsh-bws.mjs run \
  --passphrase-file %h/.config/dsh-bws/pass \
  -- /path/to/your-service
```

**C. 环境变量（最方便的临时手段，别进 unit 文件）**

```bash
DSH_BWS_PASSPHRASE='...' dsh-bws run -- ./script.sh
```

> 三者都不完美：B/C 都让口令以某种形式落到磁盘或进程环境。要彻底消除，需要 TPM/systemd-creds 或一台常驻的解锁守护进程——本插件暂未实现。

## 6. 第二台机器（甲方案：搬钥匙文件）

新机器**零输入**接入，前提是拿到旧机器的钥匙文件 `~/.config/dsh-bws/key`：

1. 装插件 → 重启 dsh-web（此时还没有金库）。
2. 面板里建库（口令随便设，只是占位）→ 「同步」页填远端 → **拉取**。首次拉取会自动改用远端的盐并锁定。
3. 搬钥匙：
   ```bash
   # 旧机器
   dsh-bws key export --out /tmp/dsh-bws-key
   # 新机器
   dsh-bws key import /tmp/dsh-bws-key
   ```
   （等价于直接 `scp ~/.config/dsh-bws/key 新机器:...`，格式都是 base64 的 32 字节 + 0600。）
4. 刷新面板 → 口令门多出「用本机钥匙解锁」，点一下即可。CLI 与 systemd 服务此后不需要口令。

`key import` 会先验证这把钥匙能不能打开本机金库（对不上直接 exit 3，不会写坏文件）。

> 钥匙文件 = 解锁密钥本身。谁拿到它谁能解密，所以用 scp / 密码管理器搬，**不要**放进仓库、聊天或公开位置。
> 丢了钥匙就用主口令重新解锁一次，再「保存到本机」。

**换口令（原地）：** 面板「同步 → 主口令」或 `dsh-bws passwd`：输当前口令 + 新口令两次 → 生成新盐、
用新密钥逐条重新封装密文（本机 24 条约 0.1 秒）→ 同时重写本机 `key` 与 `passphrase` 文件 → 提交。
推上去后：其它机器用**新口令**解锁，或重新 `key import` 这台机器的新钥匙。旧口令立刻失效。

**轮换密钥：** 直接改值即可；git 历史里的旧密文抹不掉，真正作废要轮换上游（重新签发 token / 换数据库密码）。

## 7. 自检清单

```bash
curl -s localhost:3080/bws/status | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j.ok,j.initialized,j.locked,j.secrets)})'
ls -l ~/.dsh/dsh-bws/            # vault.db 0600
git -C ~/.dsh/dsh-bws/repo log --oneline | head
dsh-bws list | head        # 有 key 文件时不需要口令
```

四条安全边界（改动前先想清楚）：

1. 金库目录 `0700`、`vault.db` 与 `.enc` `0600`。
2. 口令、明文值**不写**任何文件、日志、会话记录。
3. 推送凭据只在 git 自己的配置里，插件不读不存。
4. `/bws` 仅 loopback + 自定义头，但**同机任何进程**都能访问：这台机器上跑的东西等于能读金库（解锁期间）。
