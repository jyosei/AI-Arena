#!/bin/sh
# wait-for-db.sh
# 等待数据库端口可用后执行后续命令
# 支持 DB_PORT 环境变量覆盖默认端口 3306
# 兼容 Windows CRLF

host="$1"
shift
port="${DB_PORT:-3306}"
cmd="$@"

echo "[wait-for-db] Waiting for $host:$port ..." >&2

# 循环检测端口
while true; do
  if nc -z "$host" "$port" 2>/dev/null; then
    echo "[wait-for-db] MySQL ready - executing: $cmd" >&2
    break
  fi
  echo "[wait-for-db] MySQL not ready - retry in 1s" >&2
  sleep 1
done

# 执行命令，兼容多参数和空格
exec sh -c "$cmd"
