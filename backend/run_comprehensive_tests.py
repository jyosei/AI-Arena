#!/usr/bin/env python3
"""
AI-Arena 测试运行器脚本

使用方法:
    python run_comprehensive_tests.py          # 运行所有测试
    python run_comprehensive_tests.py --unit   # 仅单元测试
    python run_comprehensive_tests.py --integration  # 仅集成测试
    python run_comprehensive_tests.py --e2e    # 仅端到端测试
    python run_comprehensive_tests.py --verbose  # 详细输出
"""

import os
import sys
import django
import argparse
import subprocess
from pathlib import Path

# 设置Django环境
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ai_arena_backend.settings')
django.setup()

from django.core.management import call_command
from django.test.utils import get_runner
from django.conf import settings


def run_unit_tests():
    """运行单元测试"""
    print("\n" + "="*80)
    print("运行单元测试")
    print("="*80)
    
    test_cases = [
        'test_suite.UserModelTests',
        'test_suite.UserFollowTests',
        'test_suite.ForumCategoryTests',
        'test_suite.ForumPostTests',
        'test_suite.ForumCommentTests',
        'test_suite.ForumTagTests',
    ]
    
    for test_case in test_cases:
        try:
            call_command('test', test_case, verbosity=2)
        except Exception as e:
            print(f"❌ {test_case} 失败: {e}")
    
    print("\n✅ 单元测试完成")


def run_integration_tests():
    """运行集成测试"""
    print("\n" + "="*80)
    print("运行集成测试")
    print("="*80)
    
    test_cases = [
        'test_suite.AuthenticationIntegrationTests',
        'test_suite.UserProfileIntegrationTests',
        'test_suite.ForumIntegrationTests',
        'test_suite.UserFollowIntegrationTests',
    ]
    
    for test_case in test_cases:
        try:
            call_command('test', test_case, verbosity=2)
        except Exception as e:
            print(f"❌ {test_case} 失败: {e}")
    
    print("\n✅ 集成测试完成")


def run_e2e_tests():
    """运行端到端测试"""
    print("\n" + "="*80)
    print("运行端到端测试")
    print("="*80)
    
    test_cases = [
        'test_suite.EndToEndUserJourneyTests',
        'test_suite.EndToEndCommentThreadTests',
    ]
    
    for test_case in test_cases:
        try:
            call_command('test', test_case, verbosity=2)
        except Exception as e:
            print(f"❌ {test_case} 失败: {e}")
    
    print("\n✅ 端到端测试完成")


def run_performance_tests():
    """运行性能测试"""
    print("\n" + "="*80)
    print("运行性能和边界测试")
    print("="*80)
    
    test_cases = [
        'test_suite.PerformanceAndBoundaryTests',
    ]
    
    for test_case in test_cases:
        try:
            call_command('test', test_case, verbosity=2)
        except Exception as e:
            print(f"❌ {test_case} 失败: {e}")
    
    print("\n✅ 性能测试完成")


def run_error_handling_tests():
    """运行错误处理测试"""
    print("\n" + "="*80)
    print("运行错误处理测试")
    print("="*80)
    
    test_cases = [
        'test_suite.ErrorHandlingTests',
    ]
    
    for test_case in test_cases:
        try:
            call_command('test', test_case, verbosity=2)
        except Exception as e:
            print(f"❌ {test_case} 失败: {e}")
    
    print("\n✅ 错误处理测试完成")


def run_concurrency_tests():
    """运行并发测试"""
    print("\n" + "="*80)
    print("运行并发和竞态条件测试")
    print("="*80)
    
    test_cases = [
        'test_suite.ConcurrencyTests',
    ]
    
    for test_case in test_cases:
        try:
            call_command('test', test_case, verbosity=2)
        except Exception as e:
            print(f"❌ {test_case} 失败: {e}")
    
    print("\n✅ 并发测试完成")


def run_all_tests():
    """运行所有测试"""
    print("\n" + "🧪 "*30)
    print("AI-Arena 综合测试套件")
    print("🧪 "*30)
    
    call_command('test', 'test_suite', verbosity=2)


def run_with_coverage():
    """使用coverage运行测试"""
    print("\n" + "="*80)
    print("使用coverage运行测试")
    print("="*80)
    
    try:
        import coverage
    except ImportError:
        print("❌ 请先安装coverage: pip install coverage")
        return
    
    cov = coverage.Coverage()
    cov.start()
    
    call_command('test', 'test_suite', verbosity=2)
    
    cov.stop()
    cov.save()
    
    print("\n" + "="*80)
    print("代码覆盖率报告")
    print("="*80)
    cov.report()
    
    # 生成HTML报告
    cov.html_report(directory='htmlcov')
    print("\n✅ HTML覆盖率报告已生成到 htmlcov/ 目录")


def print_test_summary():
    """打印测试摘要"""
    print("\n" + "="*80)
    print("测试套件摘要")
    print("="*80)
    print("""
📋 单元测试:
   - UserModelTests: 用户模型基本功能
   - UserFollowTests: 用户关注功能
   - ForumCategoryTests: 论坛分类
   - ForumPostTests: 论坛帖子
   - ForumCommentTests: 论坛评论
   - ForumTagTests: 论坛标签

🔗 集成测试:
   - AuthenticationIntegrationTests: 用户认证流程
   - UserProfileIntegrationTests: 用户资料管理
   - ForumIntegrationTests: 论坛核心功能
   - UserFollowIntegrationTests: 用户关注API

🎯 端到端测试:
   - EndToEndUserJourneyTests: 完整用户注册到发帖流程
   - EndToEndCommentThreadTests: 嵌套评论流程

⚡ 性能测试:
   - 批量创建帖子性能测试
   - 大文本处理
   - 分页功能
   - 搜索功能

❌ 错误处理测试:
   - 无效JSON处理
   - 缺失字段验证
   - 不存在的资源
   - HTTP方法验证

🔄 并发测试:
   - 并发点赞
   - 并发评论
""")


def main():
    parser = argparse.ArgumentParser(description='AI-Arena 测试运行器')
    parser.add_argument('--unit', action='store_true', help='仅运行单元测试')
    parser.add_argument('--integration', action='store_true', help='仅运行集成测试')
    parser.add_argument('--e2e', action='store_true', help='仅运行端到端测试')
    parser.add_argument('--performance', action='store_true', help='仅运行性能测试')
    parser.add_argument('--errors', action='store_true', help='仅运行错误处理测试')
    parser.add_argument('--concurrency', action='store_true', help='仅运行并发测试')
    parser.add_argument('--coverage', action='store_true', help='使用coverage生成覆盖率报告')
    parser.add_argument('--verbose', action='store_true', help='详细输出')
    parser.add_argument('--summary', action='store_true', help='显示测试摘要')
    parser.add_argument('--quick', action='store_true', help='快速测试(跳过性能测试)')
    
    args = parser.parse_args()
    
    if args.summary:
        print_test_summary()
        return
    
    if args.coverage:
        run_with_coverage()
    elif args.unit:
        run_unit_tests()
    elif args.integration:
        run_integration_tests()
    elif args.e2e:
        run_e2e_tests()
    elif args.performance:
        run_performance_tests()
    elif args.errors:
        run_error_handling_tests()
    elif args.concurrency:
        run_concurrency_tests()
    elif args.quick:
        # 快速测试：跳过性能测试
        run_unit_tests()
        run_integration_tests()
        run_e2e_tests()
        run_error_handling_tests()
        run_concurrency_tests()
    else:
        # 运行所有测试
        run_all_tests()
    
    print("\n" + "="*80)
    print("测试运行完成!")
    print("="*80)


if __name__ == '__main__':
    main()
