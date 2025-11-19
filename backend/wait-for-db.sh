#!/bin/sh
# 说明: 该脚本等待数据库端口可用后再执行后续命令。
# 使用 POSIX /bin/sh 兼容写法，避免 bash 特性导致的 Illegal option 错误。
set -e

host="$1"
shift
# 可从环境变量 DB_PORT 覆盖端口，默认 3306
port="${DB_PORT:-3306}"
cmd="$@"

echo "[wait-for-db] Waiting for $host:$port ..." >&2
until nc -z "$host" "$port"; do
  echo "[wait-for-db] MySQL not ready - retry in 1s" >&2
  sleep 1
done

echo "[wait-for-db] MySQL ready - executing: $cmd" >&2
exec "$@"