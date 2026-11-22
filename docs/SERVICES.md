# 让服务与脚本在开机时取到凭证

金库本体只需要一个东西：**主口令**。人不在场时，口令得有个来源；给出处不同，
就分成了下面三层。按「这个消费者什么时候启动」选，不要按「哪个省事」选。

| 消费者 | 启动时机 | 引导来源 | 命令形态 |
|---|---|---|---|
| 交互终端 / 手动脚本 | 你敲命令时 | TTY 隐藏输入 | `dsh-bws get KEY` / `dsh-bws run …` |
| 用户级 systemd unit（默认） | 登录后；开了 linger 则**开机即启** | `~/.config/dsh-bws/passphrase`（0600，属主可读） | `ExecStart=… dsh-bws run --passphrase-file … -- <命令>` |
| 系统级 unit（必须比用户管理器更早） | 开机，`user@` 之前 | `/etc/dsh-bws/passphrase`（0600，root 可读） | 同上，加 `--data-dir`；或以 `User=` 运行 |

> 本机已执行 `loginctl enable-linger mirror`（`Linger=yes`），所以用户级 unit
> 不再依赖登录会话。要撤掉：`loginctl disable-linger mirror`。

## 引导方案

### 方案 1：钥匙文件（默认，建库时自动生成）

面板里「创建金库」时会同时写两个 0600 文件：

- `~/.config/dsh-bws/key` —— **解锁密钥本身**（base64 32 字节）。CLI 与服务优先用它，
  不需要口令，也不用再算 scrypt。
- `~/.config/dsh-bws/passphrase` —— 主口令明文备份，供 `dsh-bws passwd` 等场景使用。

已经建过库的机器：解锁后面板顶部会出现「本机还没保存解锁密钥」的提示，点一下即写入
（服务端已解锁，导出密钥不需要再输口令）。

```bash
dsh-bws passwd          # 改口令：换钥后 key 文件与 passphrase 文件一起重写
```

> 这两个文件都是「打开金库的钥匙」：门槛是文件系统权限（0600 + 目录 0700），
> 不是密码学隔离。想更强就删掉它们，改走方案 2 或每次人工解锁。

### 方案 2：systemd-creds（加固，按需）

CLI 内置了这个来源，不用自己写管道：

```bash
printf '%s' '你的主口令' > /tmp/pw
systemd-creds encrypt --user --name=dsh-bws /tmp/pw ~/.config/dsh-bws/pass.cred
rm -f /tmp/pw

# 之后所有命令用 --passphrase-cred 代替 --passphrase-file：
dsh-bws list --passphrase-cred dsh-bws
dsh-bws run --passphrase-cred dsh-bws --group <项目> -- /usr/bin/ssh -N …
```

`--passphrase-cred NAME` 会执行 `systemd-creds decrypt --user --name=NAME ~/.config/dsh-bws/NAME.cred -`；
文件位置可用 `--passphrase-cred-file` 指定。加密后的 cred 由本机 systemd 密钥解开：没有 TPM 的
机器退回主机密钥（root 持有），**拿到文件也解不开**——代价是依赖 systemd 版本与 `--user` 作用域，
并且要在目标机上验证「重启后、不登录、不解锁」也能解。不通过就退回方案 1。

### 方案 3：人工解锁（最干净，最麻烦）

不用口令文件，每次重启后由你在面板解锁；适合「服务只在你在场时才需要凭证」的场合。

## 三种取值形态

```bash
# ① 环境变量（服务自己读 env）：注入后 exec 命令
dsh-bws run --passphrase-file ~/.config/dsh-bws/passphrase --group <项目> -- \
  /usr/bin/uvicorn app:api --host 127.0.0.1 --port 8080

# ② 只认文件路径的消费者（ssh -i、PGPASSFILE、GOOGLE_APPLICATION_CREDENTIALS）：
#    --file 写成 0600，路径放在 DSH_BWS_FILE_<KEY> 里，命令退出后自动删除。
#    注意：shell 逻辑写进脚本文件，不要写在 systemd ExecStart 里。
cat >~/tunnels/bin/ssh-<项目> <<'SH'
#!/bin/sh
exec ssh -i "$DSH_BWS_FILE_SSH_CITYWALK_PEM" -N -L 5432:127.0.0.1:5432 ubuntu@<你的跳板机>
SH
chmod 755 ~/tunnels/bin/ssh-<项目>
dsh-bws run --passphrase-file … --file SSH_CITYWALK_PEM -- ~/tunnels/bin/ssh-<项目>

# ③ 单个值（脚本内部用，注意别回显到日志）
PGPASS=$(dsh-bws get --raw CITYWALK_PGPASS --passphrase-file …)
```

`--file KEY` 默认写到 `$XDG_RUNTIME_DIR/dsh-bws/<小写键名>`（tmpfs，重启即消失），
`--file KEY=/某个/路径` 可以指定位置；想留住文件加 `--keep-files`。
`--require KEY` 缺键就退出码 4，适合放在 unit 里做快速失败。

## 例：把 ssh 隧道从 bws 切到本地金库

现在的 `~/tunnels/bin/tunnel` 用 `bws secret list | python3` 逐次拉取（每次约 2 秒、
依赖网络）。切到本地金库后是本地解密（约 80 毫秒），且断网可用。

最小改法是把 `sm_get()` 的实现换掉：

```bash
sm_get(){  # sm_get <KEY> -> 打印 secret 值（保留换行）
  dsh-bws get --raw "$1" --passphrase-file "$HOME/.config/dsh-bws/passphrase" \
    || die "金库未找到密钥 '$1'"
}
```

再给 unit 加一行引导（不必改 `ExecStart`）：

```ini
[Service]
Environment=DSH_BWS_DATA_DIR=~/.dsh/dsh-bws
```

若想连 `tunnel` 脚本都不改，就让 systemd 包一层 CLI（脚本里的 `sm_get` 保持原样即可）：

```ini
[Service]
Environment=DSH_BWS_DATA_DIR=~/.dsh/dsh-bws
ExecStart=~/.local/bin/dsh-bws run \
  --passphrase-file %h/.config/dsh-bws/passphrase \
  --file SM_SSH_KEY -- ~/tunnels/bin/tunnel fg <项目>
```

## systemd 的坑（实测踩过）

1. **ExecStart 会做 `$VAR` 展开**：`/bin/sh -c 'echo $API_TOKEN'` 里的 `$API_TOKEN` 会被 systemd
   先展开（此时还没有我们的变量），结果命令被拆坏、静默退出 0。**把 shell 逻辑放进脚本文件**，
   ExecStart 只写 `CLI -- 脚本 参数`。
2. `${#VAR}`、`$(...)` 在 ExecStart 里同样不可靠；`%` 开头的 `%h` 是 systemd 自己的占位符。
3. unit 的 `PATH` 很窄（不含 nvm 与 `~/.local/bin`）。用 `~/.local/bin/dsh-bws` 这个稳定入口
   （内部 `exec` 到 nvm 的 node），或写 node 的绝对路径。
4. `stdio: inherit` 的子进程输出进 journal：普通用户 `journalctl --user -u <unit>` 可见。

## 排错

```bash
dsh-bws check --passphrase-file ~/.config/dsh-bws/passphrase   # 口令是否可解（0=可以）
echo $?                                                        # 3=口令错 4=键不存在 5=未初始化
journalctl --user -u <项目>-tunnel -n 50 --no-pager
```

unit 里 `${VAR}` 不会自动展开——systemd 只认 `$VAR`，且 `%h` 才是家目录。
`bang` 命令一律写绝对路径：user unit 的 `PATH` 很窄（不含 `~/.local/bin`）。

## 安全边界

- 口令文件被读走 = 金库被读走。它的价值是把「N 条明文散落各处」收敛成「一处钥匙 + 一处密文」，
  以及换口令/轮换凭证只改一处。
- root 能读用户的口令文件；能读磁盘的人也能读——方案 2 才挡得住「只有文件没有机器」的窃取。
- `dsh-bws get` 的输出会进管道与进程内存；不要在会写日志的地方调用它。
- 删除某条凭证不会让已物化的临时文件消失；进程退出时 CLI 会清，`--keep-files` 则不会。
