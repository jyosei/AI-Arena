#!/bin/sh
set -e

host="$1"
shift
cmd="$@"

# 寰幆妫€鏌?鐩村埌鍙互涓庢暟鎹簱鐨?3306 绔彛寤虹珛 TCP 杩炴帴
until nc -z "$host" 3306; do
  >&2 echo "MySQL is unavailable - sleeping"
  sleep 1
done

>&2 echo "MySQL is up - executing command"
# 浣跨敤 sh -c 鏉ユ墽琛屽懡浠ゅ瓧绗︿覆
exec sh -c "$cmd"