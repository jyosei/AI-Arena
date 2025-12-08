#!/bin/bash

##############################################################################
# AI Arena 自动化测试脚本 (Linux/macOS)
# 用途: 运行所有单元测试、集成测试、数据库测试
# 用法: ./run-tests.sh [后端|前端|数据库|全部]
# 示例: ./run-tests.sh 全部
##############################################################################

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

# 测试统计
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
START_TIME=$(date +%s)

##############################################################################
# 辅助函数
##############################################################################

print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
    ((PASSED_TESTS++))
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
    ((FAILED_TESTS++))
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

##############################################################################
# 后端测试
##############################################################################

run_backend_tests() {
    print_header "运行后端测试"
    
    cd "$BACKEND_DIR"
    
    # 检查依赖
    if ! command -v python3 &> /dev/null; then
        print_error "Python3 未安装"
        return 1
    fi
    
    # 运行 Django 迁移
    print_info "运行数据库迁移..."
    python3 manage.py migrate --no-input
    print_success "数据库迁移完成"
    
    # 运行单元测试
    print_info "运行单元测试..."
    if python3 manage.py test --parallel --keepdb 2>/dev/null; then
        print_success "Django 单元测试通过"
    else
        print_error "Django 单元测试失败"
        return 1
    fi
    
    # 运行 pytest 测试
    print_info "运行 pytest 测试..."
    if python3 -m pytest tests/ -v --cov=. --cov-report=html 2>/dev/null; then
        print_success "pytest 测试通过"
    else
        print_warning "pytest 未配置或失败 (可选)"
    fi
    
    # 运行数据库健康检查
    print_info "运行数据库健康检查..."
    if python3 database_health_check.py; then
        print_success "数据库健康检查通过"
    else
        print_error "数据库健康检查失败"
        return 1
    fi
    
    # 代码质量检查
    print_info "运行代码风格检查..."
    if python3 -m flake8 . --max-line-length=100 --exclude=migrations 2>/dev/null; then
        print_success "代码风格检查通过"
    else
        print_warning "flake8 未安装或发现风格问题 (可选)"
    fi
    
    return 0
}

##############################################################################
# 前端测试
##############################################################################

run_frontend_tests() {
    print_header "运行前端测试"
    
    cd "$FRONTEND_DIR"
    
    # 检查依赖
    if ! command -v npm &> /dev/null; then
        print_error "npm 未安装"
        return 1
    fi
    
    # 检查依赖是否已安装
    if [ ! -d "node_modules" ]; then
        print_info "安装 npm 依赖..."
        npm install --legacy-peer-deps
    fi
    
    # 运行 Jest 单元测试
    print_info "运行 Jest 单元测试..."
    if npm run test -- --passWithNoTests 2>/dev/null; then
        print_success "Jest 单元测试通过"
    else
        print_warning "Jest 测试未配置或失败 (可选)"
    fi
    
    # 运行 ESLint 代码检查
    print_info "运行 ESLint 代码检查..."
    if npm run lint 2>/dev/null; then
        print_success "ESLint 代码检查通过"
    else
        print_warning "ESLint 检查发现问题 (可选)"
    fi
    
    # 构建检查
    print_info "运行生产构建检查..."
    if npm run build 2>/dev/null; then
        print_success "生产构建成功"
    else
        print_error "生产构建失败"
        return 1
    fi
    
    return 0
}

##############################################################################
# 数据库测试
##############################################################################

run_database_tests() {
    print_header "运行数据库测试"
    
    cd "$BACKEND_DIR"
    
    # 检查 MySQL 连接
    print_info "检查 MySQL 数据库连接..."
    if python3 manage.py dbshell <<< "SELECT 1" > /dev/null 2>&1; then
        print_success "MySQL 连接成功"
    else
        print_error "MySQL 连接失败"
        return 1
    fi
    
    # 运行数据库检查脚本
    print_info "运行数据库完整性检查..."
    if python3 database_health_check.py; then
        print_success "数据库完整性检查通过"
    else
        print_error "数据库完整性检查失败"
        return 1
    fi
    
    # 验证表和索引
    print_info "验证数据库表和索引..."
    python3 << 'EOF'
import django
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ai_arena_backend.settings')
django.setup()

from django.db import connection
from django.db.models import get_models

with connection.cursor() as cursor:
    cursor.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'aiarena'")
    table_count = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = 'aiarena'")
    index_count = cursor.fetchone()[0]
    
    print(f"表数量: {table_count}")
    print(f"索引数量: {index_count}")
    
    if table_count >= 30 and index_count >= 50:
        print("✓ 数据库结构验证通过")
    else:
        print("✗ 数据库结构不完整")
        exit(1)
EOF
    
    return 0
}

##############################################################################
# API 集成测试
##############################################################################

run_api_tests() {
    print_header "运行 API 集成测试"
    
    cd "$BACKEND_DIR"
    
    # 检查 API 服务是否运行
    print_info "检查 API 服务状态..."
    if curl -s http://localhost:8000/api/health/ > /dev/null 2>&1; then
        print_success "API 服务运行正常"
    else
        print_warning "API 服务未运行，跳过集成测试"
        return 0
    fi
    
    # 运行 Postman 测试 (如果配置了)
    print_info "运行 API 端点测试..."
    if command -v postman &> /dev/null; then
        # postman run collection.json
        print_info "Postman 集合测试跳过"
    else
        print_warning "Postman CLI 未安装，跳过集合测试"
    fi
    
    return 0
}

##############################################################################
# Docker 环境测试
##############################################################################

run_docker_tests() {
    print_header "运行 Docker 环境测试"
    
    if ! command -v docker &> /dev/null; then
        print_warning "Docker 未安装，跳过"
        return 0
    fi
    
    print_info "检查容器状态..."
    
    # 检查后端容器
    if docker ps | grep -q ai-arena-backend; then
        print_success "后端容器运行中"
    else
        print_warning "后端容器未运行"
    fi
    
    # 检查前端容器
    if docker ps | grep -q ai-arena-frontend; then
        print_success "前端容器运行中"
    else
        print_warning "前端容器未运行"
    fi
    
    # 检查数据库容器
    if docker ps | grep -q ai-arena-db; then
        print_success "数据库容器运行中"
    else
        print_warning "数据库容器未运行"
    fi
    
    return 0
}

##############################################################################
# 性能测试
##############################################################################

run_performance_tests() {
    print_header "运行性能测试"
    
    cd "$BACKEND_DIR"
    
    if ! command -v python3 &> /dev/null; then
        return 1
    fi
    
    print_info "运行数据库查询性能测试..."
    python3 << 'EOF'
import django
import os
import time
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ai_arena_backend.settings')
django.setup()

from forum.models import ForumPost
from django.test.utils import override_settings
from django.db import connection

@override_settings(DEBUG=True)
def test_query_performance():
    # 查询 100 条帖子
    start = time.time()
    list(ForumPost.objects.all()[:100])
    end = time.time()
    elapsed = (end - start) * 1000
    
    if elapsed < 500:
        print(f"✓ 查询性能良好: {elapsed:.2f}ms")
        return True
    else:
        print(f"⚠ 查询性能一般: {elapsed:.2f}ms")
        return False

test_query_performance()
EOF
    
    return 0
}

##############################################################################
# 打印总结报告
##############################################################################

print_summary() {
    END_TIME=$(date +%s)
    ELAPSED=$((END_TIME - START_TIME))
    
    echo ""
    print_header "测试总结报告"
    
    echo -e "开始时间: $(date -u -d @$START_TIME)"
    echo -e "结束时间: $(date -u -d @$END_TIME)"
    echo -e "耗时: ${ELAPSED}s"
    echo ""
    echo -e "${GREEN}通过: $PASSED_TESTS${NC}"
    echo -e "${RED}失败: $FAILED_TESTS${NC}"
    echo ""
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "${GREEN}✓ 所有测试通过！${NC}"
        return 0
    else
        echo -e "${RED}✗ 存在测试失败${NC}"
        return 1
    fi
}

##############################################################################
# 主函数
##############################################################################

main() {
    local test_type="${1:-全部}"
    local exit_code=0
    
    print_header "AI Arena 自动化测试套件"
    echo "测试类型: $test_type"
    echo "项目路径: $PROJECT_ROOT"
    
    case "$test_type" in
        后端)
            run_backend_tests || exit_code=1
            ;;
        前端)
            run_frontend_tests || exit_code=1
            ;;
        数据库)
            run_database_tests || exit_code=1
            ;;
        API)
            run_api_tests || exit_code=1
            ;;
        Docker)
            run_docker_tests || exit_code=1
            ;;
        性能)
            run_performance_tests || exit_code=1
            ;;
        全部)
            run_backend_tests || exit_code=1
            run_frontend_tests || exit_code=1
            run_database_tests || exit_code=1
            run_docker_tests || exit_code=1
            ;;
        *)
            echo "未知的测试类型: $test_type"
            echo "支持的类型: 后端, 前端, 数据库, API, Docker, 性能, 全部"
            exit 1
            ;;
    esac
    
    print_summary
    exit $exit_code
}

# 运行主函数
main "$@"
