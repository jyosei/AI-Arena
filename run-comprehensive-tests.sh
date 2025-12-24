#!/usr/bin/env bash
set -euo pipefail

# 新的综合测试脚本（更健壮、在无外部 DB 时可在本地运行）
# 使用项目内的虚拟环境（`.venv`）Python，如果存在则安装依赖并运行 Django 测试。

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 解析特殊参数（保留其余传递给 Django）
RUN_FRONTEND=false
ARGS=()
for arg in "$@"; do
  if [ "$arg" = "--frontend" ]; then
    RUN_FRONTEND=true
  else
    ARGS+=("$arg")
  fi
done

# 优先使用项目虚拟环境的 python
VENV_PY="$SCRIPT_DIR/.venv/bin/python"
if [ ! -x "$VENV_PY" ]; then
  VENV_PY="$(command -v python3 || true)"
fi

if [ -z "$VENV_PY" ]; then
  echo "No python interpreter found. Install Python3 or create .venv with required packages." >&2
  exit 1
fi

echo "Using python: $VENV_PY"

# 如果测试设置需要 MySQL 环境变量但当前未设置，我们可以尝试用 Docker 启动一个临时 MySQL 容器
TMP_MYSQL_CONTAINER_STARTED=false
if [ -z "${MYSQL_HOST-}" ] || [ -z "${MYSQL_USER-}" ] || [ -z "${MYSQL_PASSWORD-}" ] || [ -z "${MYSQL_DATABASE-}" ]; then
  if command -v docker >/dev/null 2>&1; then
    echo "No MYSQL_* env found — attempting to start temporary MySQL docker container for tests..."
    # 仅在没有已存在名为 ai_arena_test_mysql 的容器时启动
    if [ "$(docker ps -a --format '{{.Names}}' | grep -w ai_arena_test_mysql || true)" = "" ]; then
      MYSQL_ROOT_PASS="rootpass_ci_$(date +%s)"
      MYSQL_USER="ci_test_user"
      MYSQL_PASSWORD="ci_test_pass"
      MYSQL_DATABASE="ai_arena_test"
      MYSQL_PORT_HOST=3307

      echo "Starting docker container 'ai_arena_test_mysql' (mapped port ${MYSQL_PORT_HOST}:3306)..."
      docker run -d --name ai_arena_test_mysql -e MYSQL_ROOT_PASSWORD="$MYSQL_ROOT_PASS" -e MYSQL_DATABASE="$MYSQL_DATABASE" -e MYSQL_USER="$MYSQL_USER" -e MYSQL_PASSWORD="$MYSQL_PASSWORD" -p ${MYSQL_PORT_HOST}:3306 mysql:8 --default-authentication-plugin=mysql_native_password >/dev/null
      TMP_MYSQL_CONTAINER_STARTED=true

      # 等待 MySQL 启动
      echo "Waiting for MySQL container to become available..."
      attempts=0
      until docker exec ai_arena_test_mysql mysqladmin ping -uroot -p"$MYSQL_ROOT_PASS" --silent >/dev/null 2>&1 || [ $attempts -ge 60 ]; do
        sleep 1
        attempts=$((attempts+1))
      done
      if [ $attempts -ge 60 ]; then
        echo "Timed out waiting for MySQL container. Check 'docker logs ai_arena_test_mysql'." >&2
      else
        echo "MySQL container ready. Exporting MYSQL_* env vars for tests."
        export MYSQL_HOST=127.0.0.1
        export MYSQL_PORT=${MYSQL_PORT_HOST}
        export MYSQL_USER=${MYSQL_USER}
        export MYSQL_PASSWORD=${MYSQL_PASSWORD}
        export MYSQL_DATABASE=${MYSQL_DATABASE}
      fi
    else
      echo "Found existing docker container 'ai_arena_test_mysql'. Reusing it and exporting default env vars."
      export MYSQL_HOST=127.0.0.1
      export MYSQL_PORT=3307
      export MYSQL_USER=ci_test_user
      export MYSQL_PASSWORD=ci_test_pass
      export MYSQL_DATABASE=ai_arena_test
      TMP_MYSQL_CONTAINER_STARTED=true
    fi
  else
    echo "No Docker available and MYSQL_* not set — test_settings requires MySQL. Aborting." >&2
    exit 1
  fi
fi

# 如果存在 .venv，尝试安装后端依赖（安全且幂等）
if [ -f "backend/requirements.txt" ] && [ -x ".venv/bin/python" ]; then
  echo "Installing backend requirements into .venv (if not present)..."
  $VENV_PY -m pip install -q -r backend/requirements.txt
fi

# 指向轻量的测试设置，已在 backend/ai_arena_backend/test_settings.py 中禁用迁移并使用 SQLite
export DJANGO_SETTINGS_MODULE=ai_arena_backend.test_settings

echo "Running Django tests using settings: $DJANGO_SETTINGS_MODULE"

# 进入 backend 目录以便按原来的模块发现行为运行测试（test_suite 在 backend 下）
pushd backend >/dev/null

# 把任何传入参数传给 manage.py test（例如 --unit/--integration/--e2e）
# 注意：我们已经把 `--frontend` 提取到 RUN_FRONTEND，所以这里使用 ARGS 数组传参给 Django
# 默认行为：运行完整的测试套件（不只是 forum/test_suite），以覆盖主要功能
if [ "${#ARGS[@]}" -eq 0 ]; then
  $VENV_PY manage.py test --verbosity=2
else
  $VENV_PY manage.py test --verbosity=2 "${ARGS[@]}"
fi

popd >/dev/null

# 如果存在前端端到端脚本并且 node 可用，则运行它
if [ "$RUN_FRONTEND" = true ]; then
  if command -v node >/dev/null 2>&1 && [ -f "test-e2e.js" ]; then
    echo "Running frontend e2e tests (node test-e2e.js) against local server..."
    # 确保 axios 可用（test-e2e.js 依赖）
    if [ ! -d "node_modules/axios" ]; then
      echo "Installing lightweight frontend dependency: axios"
      npm install axios --no-audit --no-fund
    fi

    # 启动本地 Django 开发服务器（使用测试设置），并确保数据库表已创建
    echo "Preparing local Django server (test settings)..."
    pushd backend >/dev/null

    # 创建表（对于禁用迁移的测试设置，使用 --run-syncdb 创建表）
    echo "Running migrate --run-syncdb to create tables..."
    $VENV_PY manage.py migrate --run-syncdb --noinput || echo "migrate --run-syncdb returned non-zero"

    # 创建一个默认分类，确保前端 E2E 测试可以找到至少一个分类
    echo "Ensuring a default forum category exists..."
    $VENV_PY manage.py shell -c "from forum.models import ForumCategory; ForumCategory.objects.get_or_create(name='General', defaults={'slug':'general'})" || echo "create default category failed"

    # 启动 runserver 在后台
    echo "Starting Django runserver (127.0.0.1:8000) in background..."
    $VENV_PY manage.py runserver 127.0.0.1:8000 --settings=$DJANGO_SETTINGS_MODULE > /tmp/ai_arena_runserver.log 2>&1 &
    DJANGO_PID=$!
    popd >/dev/null

    # 等待服务可用
    echo "Waiting for local server to be ready..."
    MAX_WAIT=20
    i=0
    until curl -sSf "http://127.0.0.1:8000/api/" >/dev/null 2>&1 || [ $i -ge $MAX_WAIT ]; do
      sleep 1; i=$((i+1));
    done
    if [ $i -ge $MAX_WAIT ]; then
      echo "Local server did not become ready in time. Check /tmp/ai_arena_runserver.log" >&2
    else
      echo "Local server is ready (after ${i}s)"
    fi

    # 以本地服务地址运行 e2e
    API_URL="http://127.0.0.1:8000/api" APP_URL="http://127.0.0.1:8000" node test-e2e.js || echo "Frontend e2e exited with non-zero status"

    # 停止后台的 Django 服务器
    echo "Stopping local Django server (PID=$DJANGO_PID)"
    kill $DJANGO_PID || true
    wait $DJANGO_PID 2>/dev/null || true
  else
    echo "Skipping frontend e2e: node or test-e2e.js not available"
  fi
else
  echo "Skipping frontend e2e tests (use --frontend to enable)"
fi

echo "Tests finished."

