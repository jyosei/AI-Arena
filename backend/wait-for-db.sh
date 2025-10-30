set -e

host="$1"
shift
cmd="$@"

# 循环检查，直到可以与数据库的 3306 端口建立 TCP 连接
until nc -z "$host" 3306; do
  >&2 echo "MySQL is unavailable - sleeping"
  sleep 1
done

>&2 echo "MySQL is up - executing command"
# 使用 sh -c 来执行命令字符串
exec sh -c "$cmd"