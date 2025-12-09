#!/usr/bin/env python
"""
数据库健康检查脚本
检查所有必要的表、字段、索引和约束是否已正确创建
"""
import os
import sys
import django
from django.db import connection
from django.db.utils import OperationalError

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ai_arena_backend.settings')
django.setup()

def check_database_health():
    """执行完整的数据库健康检查"""
    print("=" * 60)
    print("AI Arena 数据库健康检查")
    print("=" * 60)
    
    try:
        with connection.cursor() as cursor:
            # 1. 检查表是否存在
            print("\n✓ 检查核心表...")
            required_tables = {
                'users_user': '用户表',
                'forum_forumpost': '论坛帖子表',
                'forum_forumcomment': '论坛评论表',
                'models_manager_aimodel': '模型管理表',
                'models_manager_chatconversation': '聊天会话表',
                'models_manager_chatmessage': '聊天消息表',
                'models_manager_modeltestresult': '模型测试结果表',
                'models_manager_leaderboardsnapshot': '排行榜快照表',
            }
            
            missing_tables = []
            for table_name, description in required_tables.items():
                cursor.execute(f"SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = '{table_name}'")
                if cursor.fetchone():
                    print(f"  ✓ {table_name:45} - {description}")
                else:
                    print(f"  ✗ {table_name:45} - {description} [缺失]")
                    missing_tables.append(table_name)
            
            if missing_tables:
                print(f"\n⚠️  警告: 缺失 {len(missing_tables)} 个表")
            else:
                print(f"\n✓ 所有核心表都已存在")
            
            # 2. 检查新模型表的字段
            print("\n✓ 检查新模型表字段...")
            
            # 检查 ModelTestResult 表
            cursor.execute("DESC models_manager_modeltestresult")
            fields = {row[0]: row[1] for row in cursor.fetchall()}
            required_fields = {
                'id': '主键',
                'model_id': '模型外键',
                'test_type': '测试类型',
                'test_name': '测试名称',
                'score': '测试分数',
                'metrics': 'JSON指标',
                'status': '状态',
                'created_at': '创建时间',
                'created_by_id': '创建者ID',
            }
            for field_name, desc in required_fields.items():
                if field_name in fields:
                    print(f"  ✓ models_manager_modeltestresult.{field_name:20} - {desc}")
                else:
                    print(f"  ✗ models_manager_modeltestresult.{field_name:20} - {desc} [缺失]")
            
            # 检查 LeaderboardSnapshot 表
            cursor.execute("DESC models_manager_leaderboardsnapshot")
            fields = {row[0]: row[1] for row in cursor.fetchall()}
            required_fields = {
                'id': '主键',
                'snapshot_date': '快照日期',
                'leaderboard_data': 'JSON排行榜数据',
                'total_models': '模型总数',
                'total_battles': '战斗总数',
            }
            for field_name, desc in required_fields.items():
                if field_name in fields:
                    print(f"  ✓ models_manager_leaderboardsnapshot.{field_name:20} - {desc}")
                else:
                    print(f"  ✗ models_manager_leaderboardsnapshot.{field_name:20} - {desc} [缺失]")
            
            # 3. 检查关键索引
            print("\n✓ 检查数据库索引...")
            cursor.execute("""
                SELECT TABLE_NAME, COUNT(*) as index_count 
                FROM information_schema.statistics 
                WHERE table_schema = DATABASE() 
                GROUP BY TABLE_NAME 
                ORDER BY index_count DESC LIMIT 10
            """)
            total_indexes = 0
            for table_name, index_count in cursor.fetchall():
                print(f"  {table_name:40} - {index_count:2} 个索引")
                total_indexes += index_count
            print(f"\n  总计: {total_indexes} 个索引")
            
            # 4. 检查外键约束
            print("\n✓ 检查外键约束...")
            cursor.execute("""
                SELECT 
                    CONSTRAINT_NAME, 
                    TABLE_NAME,
                    REFERENCED_TABLE_NAME
                FROM information_schema.REFERENTIAL_CONSTRAINTS
                WHERE CONSTRAINT_SCHEMA = DATABASE()
                ORDER BY TABLE_NAME
            """)
            fk_count = 0
            for constraint_name, table_name, ref_table in cursor.fetchall():
                print(f"  {table_name:35} -> {ref_table:35}")
                fk_count += 1
            print(f"\n  总计: {fk_count} 个外键约束")
            
            # 5. 检查数据完整性
            print("\n✓ 检查数据完整性...")
            tables_with_data = [
                'users_user',
                'models_manager_aimodel',
                'forum_forumpost',
                'models_manager_chatconversation',
            ]
            
            for table_name in tables_with_data:
                cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
                count = cursor.fetchone()[0]
                status = "✓" if count > 0 else "○"
                print(f"  {status} {table_name:40} - {count:6} 条记录")
            
            # 6. 功能测试 - 验证新表是否可写入
            print("\n✓ 执行功能测试...")
            
            # 测试 LeaderboardSnapshot 插入
            try:
                from datetime import datetime
                cursor.execute("""
                    INSERT INTO models_manager_leaderboardsnapshot 
                    (snapshot_date, leaderboard_data, total_models, total_battles)
                    VALUES (%s, %s, %s, %s)
                """, [datetime.now(), '[]', 0, 0])
                test_snapshot_id = cursor.lastrowid
                
                cursor.execute(f"DELETE FROM models_manager_leaderboardsnapshot WHERE id = {test_snapshot_id}")
                connection.commit()
                print(f"  ✓ LeaderboardSnapshot 表 - 读写测试通过")
            except Exception as e:
                print(f"  ✗ LeaderboardSnapshot 表 - 读写测试失败: {e}")
            
            # 测试 ModelTestResult 插入
            try:
                cursor.execute("""
                    SELECT id FROM models_manager_aimodel LIMIT 1
                """)
                model = cursor.fetchone()
                if model:
                    model_id = model[0]
                    cursor.execute("""
                        INSERT INTO models_manager_modeltestresult 
                        (test_type, test_name, score, metrics, status, created_at, updated_at, model_id)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """, ['accuracy', 'test', 0.95, '{}', 'passed', datetime.now(), datetime.now(), model_id])
                    test_result_id = cursor.lastrowid
                    
                    cursor.execute(f"DELETE FROM models_manager_modeltestresult WHERE id = {test_result_id}")
                    connection.commit()
                    print(f"  ✓ ModelTestResult 表 - 读写测试通过")
                else:
                    print(f"  ○ ModelTestResult 表 - 跳过(无模型记录)")
            except Exception as e:
                print(f"  ✗ ModelTestResult 表 - 读写测试失败: {e}")
            
    except OperationalError as e:
        print(f"\n✗ 数据库连接错误: {e}")
        return False
    
    print("\n" + "=" * 60)
    print("✓ 数据库健康检查完成")
    print("=" * 60)
    return True

if __name__ == '__main__':
    success = check_database_health()
    sys.exit(0 if success else 1)
