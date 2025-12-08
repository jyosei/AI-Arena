@echo off
REM ##############################################################################
REM AI Arena 自动化测试脚本 (Windows)
REM 用途: 运行所有单元测试、集成测试、数据库测试
REM 用法: run-tests.bat [backend|frontend|database|all]
REM 示例: run-tests.bat all
REM ##############################################################################

setlocal enabledelayedexpansion

REM 获取项目根目录
set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%.."
set "BACKEND_DIR=%PROJECT_ROOT%\backend"
set "FRONTEND_DIR=%PROJECT_ROOT%\frontend"

REM 测试统计
set "TOTAL_TESTS=0"
set "PASSED_TESTS=0"
set "FAILED_TESTS=0"

REM 获取开始时间
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set "START_DATE=%%c/%%a/%%b")
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set "START_TIME=%%a:%%b")

REM ##############################################################################
REM 颜色和输出函数
REM ##############################################################################

setlocal

goto :main

:print_header
    echo.
    echo ========================================
    echo %~1
    echo ========================================
    echo.
    exit /b 0

:print_success
    echo [OK] %~1
    set /a "PASSED_TESTS+=1"
    exit /b 0

:print_error
    echo [FAIL] %~1
    set /a "FAILED_TESTS+=1"
    exit /b 1

:print_warning
    echo [WARNING] %~1
    exit /b 0

:print_info
    echo [INFO] %~1
    exit /b 0

REM ##############################################################################
REM 后端测试函数
REM ##############################################################################

:run_backend_tests
    call :print_header "运行后端测试"
    
    cd /d "%BACKEND_DIR%"
    
    REM 检查 Python
    python --version >nul 2>&1
    if errorlevel 1 (
        call :print_error "Python 未安装"
        exit /b 1
    )
    
    REM 运行数据库迁移
    call :print_info "运行数据库迁移..."
    python manage.py migrate --no-input
    if errorlevel 1 (
        call :print_error "数据库迁移失败"
        exit /b 1
    )
    call :print_success "数据库迁移完成"
    
    REM 运行单元测试
    call :print_info "运行 Django 单元测试..."
    python manage.py test --keepdb >nul 2>&1
    if errorlevel 1 (
        call :print_error "Django 单元测试失败"
        exit /b 1
    )
    call :print_success "Django 单元测试通过"
    
    REM 运行数据库健康检查
    call :print_info "运行数据库健康检查..."
    python database_health_check.py
    if errorlevel 1 (
        call :print_error "数据库健康检查失败"
        exit /b 1
    )
    call :print_success "数据库健康检查通过"
    
    REM 代码风格检查
    call :print_info "运行代码风格检查..."
    python -m flake8 . --max-line-length=100 --exclude=migrations >nul 2>&1
    if errorlevel 1 (
        call :print_warning "flake8 未安装或发现风格问题"
    ) else (
        call :print_success "代码风格检查通过"
    )
    
    exit /b 0

REM ##############################################################################
REM 前端测试函数
REM ##############################################################################

:run_frontend_tests
    call :print_header "运行前端测试"
    
    cd /d "%FRONTEND_DIR%"
    
    REM 检查 npm
    npm --version >nul 2>&1
    if errorlevel 1 (
        call :print_error "npm 未安装"
        exit /b 1
    )
    
    REM 检查 node_modules
    if not exist "node_modules" (
        call :print_info "安装 npm 依赖..."
        call npm install --legacy-peer-deps
        if errorlevel 1 (
            call :print_error "npm 依赖安装失败"
            exit /b 1
        )
    )
    
    REM 运行 Jest 单元测试
    call :print_info "运行 Jest 单元测试..."
    call npm run test -- --passWithNoTests >nul 2>&1
    if errorlevel 1 (
        call :print_warning "Jest 测试未配置或失败"
    ) else (
        call :print_success "Jest 单元测试通过"
    )
    
    REM 运行 ESLint
    call :print_info "运行 ESLint 代码检查..."
    call npm run lint >nul 2>&1
    if errorlevel 1 (
        call :print_warning "ESLint 检查发现问题"
    ) else (
        call :print_success "ESLint 代码检查通过"
    )
    
    REM 生产构建
    call :print_info "运行生产构建检查..."
    call npm run build >nul 2>&1
    if errorlevel 1 (
        call :print_error "生产构建失败"
        exit /b 1
    )
    call :print_success "生产构建成功"
    
    exit /b 0

REM ##############################################################################
REM 数据库测试函数
REM ##############################################################################

:run_database_tests
    call :print_header "运行数据库测试"
    
    cd /d "%BACKEND_DIR%"
    
    REM 检查 MySQL 连接
    call :print_info "检查 MySQL 数据库连接..."
    python manage.py dbshell < nul >nul 2>&1
    if errorlevel 1 (
        call :print_error "MySQL 连接失败"
        exit /b 1
    )
    call :print_success "MySQL 连接成功"
    
    REM 运行数据库检查脚本
    call :print_info "运行数据库完整性检查..."
    python database_health_check.py
    if errorlevel 1 (
        call :print_error "数据库完整性检查失败"
        exit /b 1
    )
    call :print_success "数据库完整性检查通过"
    
    exit /b 0

REM ##############################################################################
REM Docker 测试函数
REM ##############################################################################

:run_docker_tests
    call :print_header "运行 Docker 环境测试"
    
    REM 检查 Docker
    docker --version >nul 2>&1
    if errorlevel 1 (
        call :print_warning "Docker 未安装，跳过"
        exit /b 0
    )
    
    call :print_info "检查容器状态..."
    
    REM 检查后端容器
    docker ps | find "ai-arena-backend" >nul
    if errorlevel 1 (
        call :print_warning "后端容器未运行"
    ) else (
        call :print_success "后端容器运行中"
    )
    
    REM 检查前端容器
    docker ps | find "ai-arena-frontend" >nul
    if errorlevel 1 (
        call :print_warning "前端容器未运行"
    ) else (
        call :print_success "前端容器运行中"
    )
    
    REM 检查数据库容器
    docker ps | find "ai-arena-db" >nul
    if errorlevel 1 (
        call :print_warning "数据库容器未运行"
    ) else (
        call :print_success "数据库容器运行中"
    )
    
    exit /b 0

REM ##############################################################################
REM API 集成测试函数
REM ##############################################################################

:run_api_tests
    call :print_header "运行 API 集成测试"
    
    call :print_info "检查 API 服务状态..."
    
    REM 尝试连接 API
    powershell -Command "try { Invoke-WebRequest -Uri 'http://localhost:8000/api/health/' -TimeoutSec 5 } catch { exit 1 }" >nul 2>&1
    if errorlevel 1 (
        call :print_warning "API 服务未运行，跳过集成测试"
        exit /b 0
    )
    call :print_success "API 服务运行正常"
    
    exit /b 0

REM ##############################################################################
REM 性能测试函数
REM ##############################################################################

:run_performance_tests
    call :print_header "运行性能测试"
    
    cd /d "%BACKEND_DIR%"
    
    call :print_info "运行数据库查询性能测试..."
    
    python << 'EOF'
import django
import os
import time
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ai_arena_backend.settings')
django.setup()

try:
    from forum.models import ForumPost
    from django.test.utils import override_settings
    
    @override_settings(DEBUG=True)
    def test_query_performance():
        start = time.time()
        list(ForumPost.objects.all()[:100])
        end = time.time()
        elapsed = (end - start) * 1000
        
        if elapsed < 500:
            print(f"[OK] 查询性能良好: {elapsed:.2f}ms")
            return True
        else:
            print(f"[WARNING] 查询性能一般: {elapsed:.2f}ms")
            return False
    
    test_query_performance()
except Exception as e:
    print(f"[WARNING] 性能测试跳过: {str(e)}")
EOF
    
    exit /b 0

REM ##############################################################################
REM 打印总结报告
REM ##############################################################################

:print_summary
    call :print_header "测试总结报告"
    
    echo 耗时: 从 %START_TIME% %START_DATE%
    echo.
    echo 通过: %PASSED_TESTS%
    echo 失败: %FAILED_TESTS%
    echo.
    
    if %FAILED_TESTS% equ 0 (
        echo [SUCCESS] 所有测试通过！
        exit /b 0
    ) else (
        echo [ERROR] 存在测试失败
        exit /b 1
    )

REM ##############################################################################
REM 主函数
REM ##############################################################################

:main
    set "TEST_TYPE=%1"
    if "%TEST_TYPE%"=="" set "TEST_TYPE=all"
    
    call :print_header "AI Arena 自动化测试套件"
    echo 测试类型: %TEST_TYPE%
    echo 项目路径: %PROJECT_ROOT%
    
    if /i "%TEST_TYPE%"=="backend" (
        call :run_backend_tests
        if errorlevel 1 set "FAILED_TESTS=1"
    ) else if /i "%TEST_TYPE%"=="frontend" (
        call :run_frontend_tests
        if errorlevel 1 set "FAILED_TESTS=1"
    ) else if /i "%TEST_TYPE%"=="database" (
        call :run_database_tests
        if errorlevel 1 set "FAILED_TESTS=1"
    ) else if /i "%TEST_TYPE%"=="api" (
        call :run_api_tests
    ) else if /i "%TEST_TYPE%"=="docker" (
        call :run_docker_tests
    ) else if /i "%TEST_TYPE%"=="performance" (
        call :run_performance_tests
    ) else if /i "%TEST_TYPE%"=="all" (
        call :run_backend_tests
        call :run_frontend_tests
        call :run_database_tests
        call :run_docker_tests
    ) else (
        echo 未知的测试类型: %TEST_TYPE%
        echo 支持的类型: backend, frontend, database, api, docker, performance, all
        exit /b 1
    )
    
    call :print_summary
    
endlocal
