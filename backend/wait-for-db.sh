#!/bin/sh
# 说明: 等待数据库端口可用后执行后续命令。
# 去掉 set -e，避免因潜在 CRLF 造成 "set: Illegal option -"；使用显式返回码控制。

host="$1"
shift
# 可从环境变量 DB_PORT 覆盖端口，默认 3306
port="${DB_PORT:-3306}"
cmd="$@"

echo "[wait-for-db] Waiting for $host:$port ..." >&2
while true; do
  if nc -z "$host" "$port" 2>/dev/null; then
    echo "[wait-for-db] MySQL ready - executing: $cmd" >&2
    break
  fi
  echo "[wait-for-db] MySQL not ready - retry in 1s" >&2
  sleep 1
done

exec "$@"