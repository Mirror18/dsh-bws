/**
 * 由插件自动安装到 `$DSH_HOME/skills/dsh-bws/SKILL.md` 的规范文本。
 *
 * 内容改动后 hash 不同，插件启动时会重写；skill 目录被文件系统 provider 监视，
 * 所以改完下一次会话（或热加载后）即可见，不需要用户手动同步。
 */
export const SKILL_VERSION = 4

export const SKILL_TEXT = `---
name: dsh-bws
description: 本机的凭证金库（dsh-bws 插件）的使用规范。当你要为项目新增、复用、迁移、轮换任何密钥/口令/证书/连接串，或要给新项目（新工作区）配置环境变量与部署脚本时，先读本规范再动手；它规定了命名、分组、备注格式、取值方式、授权与清理的硬性做法，避免把明文散落到仓库、.env 文件或对话里。
---

# 凭证规范（dsh-bws 金库）

这台机器的凭证存在本地加密金库里，DSH 通过 \`bws_*\` 工具使用。**不要把密钥写进仓库、\`.env\`、脚本明文或对话**；下面所有动作都有对应工具或面板。

## 0. 先查，再建

调用 \`bws_list\` 看已有条目（只返回键名 / 分组 / 备注 / 长度，不返回值）。已有能复用的就复用；同一个值不要建两条。

## 1. 命名

- 键名必须匹配 \`^[A-Z][A-Z0-9_]*$\`（大写、下划线、数字）。
- **项目层**加项目前缀：\`CITYWALK_MP_JWT_SECRET\`、\`CITYWALK_DB_PASSWORD\`。
- **通用层**不加项目前缀：\`GITHUB_TOKEN\`、\`SSH_ID_ED25519\`。
- 名字要能一眼看出「谁的什么」；不要用 \`KEY1\`、\`SECRET\`、\`TOKEN\` 这种。

## 2. 备注（note）格式

第一行用 \`type=...\` 声明形态，后面可跟上下文，便于后来人判断怎么用：

\`\`\`
type=env|envfile|json|pem|pgpass|token|password
owner=<归属项目/服务>
host=<主机或域名>
consumer=<读取它的脚本或进程>
path=<落盘位置（仅 envfile/pem/pgpass 这类整文件形态）>
\`\`\`

例：\`type=envfile owner=litellm consumer=~/gemini-keys/run_litellm.sh\`
例：\`type=password owner=<项目> host=<跳板机> path=~/.pgpass（127.0.0.1:5432:<项目>:<项目>）\`

**说不清消费者的条目不要建。**

## 3. 放进哪个分组

- **通用层**（\`tier=shared\`）：跨项目复用、所有工作区都能读写（GitHub token、个人 SSH key 这类）。
- **项目层**（\`tier=project\`）：只属于一个项目，只有被授权的**工作区**能读/写。
- 分组由用户在面板「授权」页创建；没有分组时工具与迁移都会被拒绝，不要自己造分组 id。

## 4. 取值：只注入，不回显

- 变量形态：\`bws_run\`（把选中的条目注入子进程环境变量后执行命令），模型只看得到命令输出。
- 整文件形态（PEM / JSON / pgpass / env 文件）：用 \`bws_run\` 里的环境变量在命令中写到 \`mktemp -d\` 临时目录，\`chmod 600\`，命令结束立即删除；例：
  \`\`\`sh
  d=$(mktemp -d); printf '%s' "$GEMINI_VERTEX_SA" > "$d/vertex-sa.json"; chmod 600 "$d/vertex-sa.json"
  GOOGLE_APPLICATION_CREDENTIALS="$d/vertex-sa.json" <命令>; rc=$?; rm -rf "$d"; exit $rc
  \`\`\`
- **不要**把值 \`echo\` 出来、不要写进会话、不要 \`cat\` 到 stdout；面板里「显示值」只用于人眼核对，20 秒自动消失。
- 需要长期在服务里用时，优先用 CLI 的 systemd 形态（见 \`docs/SERVICES.md\`）：
  \`ExecStart=… dsh-bws run --passphrase-file ~/.config/dsh-bws/passphrase --group <分组> -- <命令>\`，
  只认文件路径的消费者加 \`--file KEY\`（自动 0600、退出即删、路径在 \`$DSH_BWS_FILE_<KEY>\`）。
  开机自启还需 \`loginctl enable-linger <用户>\`（本机已开）。

## 5. 新项目 / 新工作区接入

1. 新建工作区后，把它需要的项目层分组授权给它：
   \`bws_grant({ group: "<项目>", level: "write", workspace: "/path/to/project" })\`
   （\`workspace\` 省略=当前工作区；\`level\` 取 read / write / none）。也可以让用户在面板「授权」页勾选。
2. 通用层不需要授权，所有工作区默认可读写。
3. 授权只影响 \`bws_list\` / \`bws_run\` 能看到与使用的范围；它不改变 Bitwarden 或 git 端。

## 6. 迁移与清理

- 从 bws 迁移用面板「同步 → 从 bws 迁移」（选好未识别键归入哪个分组）。
- 密钥入库后，**把仓库/家目录里的明文删掉**：\`.env\`、\`pgpass\`、\`*.pem\`、\`credentials.json\`。
- 仓库 \`.gitignore\` 保留：\`.env*\`、\`*.pem\`、\`*.key\`、\`pgpass\`、\`.pgpass\`。
- 已提交进 git 的明文要先轮换再删（历史抹不掉）。

## 7. 轮换与边界

- 值只在解锁后的进程内存与单次调用中出现；金库文件是 \`~/.dsh/dsh-bws/\`（\`vault.db\` 0600 + \`repo/\` 加密副本）。
- 口令丢了数据就找不回来，也没有后门；换机器用同一口令 + 拉取远端仓库（会自动采纳远端盐并提示重新解锁）。
- 只读、能算：不要为了「方便」把值复制到别处；需要给别人用就走 \`bws_run\` 注入。
`
