#!/bin/bash
# 测试脚本 - run-comprehensive-tests.sh
# 
# 使用方法:
#   bash run-comprehensive-tests.sh                # 运行所有测试
#   bash run-comprehensive-tests.sh --unit         # 仅单元测试
#   bash run-comprehensive-tests.sh --integration  # 仅集成测试
#   bash run-comprehensive-tests.sh --coverage     # 带覆盖率报告

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 帮助函数
print_header() {
    echo -e "\n${BLUE}════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}════════════════════════════════════════════${NC}\n"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# 检查环境
check_environment() {
    print_header "检查环境"
    
    if ! command -v python3 &> /dev/null; then
        print_error "Python3 未找到"
        exit 1
    fi
    print_success "Python3 已安装"
    
    if ! command -v docker &> /dev/null; then
        print_info "Docker 未安装，使用本地环境"
    else
        print_success "Docker 已安装"
    fi
}

# 检查依赖
check_dependencies() {
    print_header "检查依赖"
    
    cd backend
    
    # 检查必要的Python包
    python3 -c "import django" 2>/dev/null && print_success "Django 已安装" || {
        print_error "Django 未安装"
        exit 1
    }
    
    python3 -c "import rest_framework" 2>/dev/null && print_success "DRF 已安装" || {
        print_error "DRF 未安装"
        exit 1
    }
    
    python3 -c "import coverage" 2>/dev/null && print_success "Coverage 已安装" || {
        print_info "Coverage 未安装，跳过覆盖率报告"
        HAS_COVERAGE=false
    }
    
    cd ..
}

# 初始化数据库
init_database() {
    print_header "初始化测试数据库"
    
    cd backend
    
    # 运行迁移
    python3 manage.py migrate --noinput 2>/dev/null || {
        print_error "数据库迁移失败"
        exit 1
    }
    
    print_success "数据库初始化完成"
    cd ..
}

# 运行单元测试
run_unit_tests() {
    print_header "运行单元测试"
    
    cd backend
    
    python3 manage.py test test_suite.UserModelTests \
                            test_suite.UserFollowTests \
                            test_suite.ForumCategoryTests \
                            test_suite.ForumPostTests \
                            test_suite.ForumCommentTests \
                            test_suite.ForumTagTests \
        --verbosity=2
    
    if [ $? -eq 0 ]; then
        print_success "单元测试通过"
    else
        print_error "单元测试失败"
        exit 1
    fi
    
    cd ..
}

# 运行集成测试
run_integration_tests() {
    print_header "运行集成测试"
    
    cd backend
    
    python3 manage.py test test_suite.AuthenticationIntegrationTests \
                            test_suite.UserProfileIntegrationTests \
                            test_suite.ForumIntegrationTests \
                            test_suite.UserFollowIntegrationTests \
        --verbosity=2
    
    if [ $? -eq 0 ]; then
        print_success "集成测试通过"
    else
        print_error "集成测试失败"
        exit 1
    fi
    
    cd ..
}

# 运行端到端测试
run_e2e_tests() {
    print_header "运行端到端测试"
    
    cd backend
    
    python3 manage.py test test_suite.EndToEndUserJourneyTests \
                            test_suite.EndToEndCommentThreadTests \
        --verbosity=2
    
    if [ $? -eq 0 ]; then
        print_success "端到端测试通过"
    else
        print_error "端到端测试失败"
        exit 1
    fi
    
    cd ..
}

# 运行性能测试
run_performance_tests() {
    print_header "运行性能和边界测试"
    
    cd backend
    
    python3 manage.py test test_suite.PerformanceAndBoundaryTests \
        --verbosity=2
    
    if [ $? -eq 0 ]; then
        print_success "性能测试通过"
    else
        print_error "性能测试失败"
        exit 1
    fi
    
    cd ..
}

# 运行错误处理测试
run_error_tests() {
    print_header "运行错误处理测试"
    
    cd backend
    
    python3 manage.py test test_suite.ErrorHandlingTests \
        --verbosity=2
    
    if [ $? -eq 0 ]; then
        print_success "错误处理测试通过"
    else
        print_error "错误处理测试失败"
        exit 1
    fi
    
    cd ..
}

# 运行并发测试
run_concurrency_tests() {
    print_header "运行并发测试"
    
    cd backend
    
    python3 manage.py test test_suite.ConcurrencyTests \
        --verbosity=2
    
    if [ $? -eq 0 ]; then
        print_success "并发测试通过"
    else
        print_error "并发测试失败"
        exit 1
    fi
    
    cd ..
}

# 生成覆盖率报告
generate_coverage() {
    print_header "生成覆盖率报告"
    
    if [ "$HAS_COVERAGE" = false ]; then
        print_info "Coverage 未安装，跳过覆盖率报告"
        return
    fi
    
    cd backend
    
    # 运行带覆盖率的测试
    coverage run --source='.' manage.py test test_suite
    
    # 生成报告
    coverage report
    
    # 生成HTML报告
    coverage html
    
    print_success "覆盖率报告已生成到 htmlcov/ 目录"
    
    cd ..
}

# 运行前端端到端测试
run_frontend_e2e() {
    print_header "运行前端端到端测试"
    
    if ! command -v node &> /dev/null; then
        print_info "Node.js 未安装，跳过前端测试"
        return
    fi
    
    # 检查依赖
    if [ ! -f "node_modules/.bin/axios" ]; then
        print_info "安装前端依赖..."
        npm install axios
    fi
    
    # 运行测试
    node test-e2e.js
    
    if [ $? -eq 0 ]; then
        print_success "前端端到端测试通过"
    else
        print_error "前端端到端测试失败"
        exit 1
    fi
}

# 打印报告摘要
print_summary() {
    print_header "测试运行完成"
    
    echo -e "${GREEN}✅ 所有测试已成功运行！${NC}\n"
}

# 主函数
main() {
    local run_all=true
    local run_unit=false
    local run_integration=false
    local run_e2e=false
    local run_coverage=false
    local run_frontend=false
    
    # 解析参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            --unit)
                run_all=false
                run_unit=true
                shift
                ;;
            --integration)
                run_all=false
                run_integration=true
                shift
                ;;
            --e2e)
                run_all=false
                run_e2e=true
                shift
                ;;
            --coverage)
                run_coverage=true
                shift
                ;;
            --frontend)
                run_frontend=true
                shift
                ;;
            --quick)
                run_all=false
                run_unit=true
                run_integration=true
                run_e2e=true
                shift
                ;;
            --help)
                echo "使用方法:"
                echo "  $0                    # 运行所有测试"
                echo "  $0 --unit             # 仅单元测试"
                echo "  $0 --integration      # 仅集成测试"
                echo "  $0 --e2e              # 仅端到端测试"
                echo "  $0 --quick            # 快速测试(跳过性能)"
                echo "  $0 --coverage         # 带覆盖率报告"
                echo "  $0 --frontend         # 前端端到端测试"
                exit 0
                ;;
            *)
                echo "未知参数: $1"
                exit 1
                ;;
        esac
    done
    
    # 初始化
    check_environment
    check_dependencies
    init_database
    
    # 运行测试
    if [ "$run_all" = true ]; then
        run_unit_tests
        run_integration_tests
        run_e2e_tests
        run_performance_tests
        run_error_tests
        run_concurrency_tests
        run_frontend_e2e
    else
        [ "$run_unit" = true ] && run_unit_tests
        [ "$run_integration" = true ] && run_integration_tests
        [ "$run_e2e" = true ] && run_e2e_tests
    fi
    
    # 覆盖率报告
    if [ "$run_coverage" = true ]; then
        generate_coverage
    fi
    
    # 输出摘要
    print_summary
}

# 运行主函数
main "$@"
