# AI Arena 新增数据模型快速参考

> 编辑: shallcheer

## 模型测试结果 (ModelTestResult)

### 表信息
- **表名**: `models_manager_modeltestresult`
- **用途**: 存储模型的测试结果和性能指标
- **记录数**: 0 (新表，待数据)
- **索引数**: 6个

### 数据字段

```python
class ModelTestResult(models.Model):
    model = ForeignKey(AIModel)           # 测试的模型
    test_type = CharField(50)             # 测试类型: accuracy|latency|throughput|perplexity|custom
    test_name = CharField(255)            # 测试名称，如 "ImageNet 2025-Q1"
    description = TextField()             # 测试描述
    test_data = JSONField()               # 测试输入数据
    score = FloatField()                  # 主要评分结果 (0-100)
    metrics = JSONField()                 # 详细指标: {precision, recall, f1, ...}
    status = CharField(20)                # 状态: pending|running|passed|failed
    created_at = DateTime()               # 创建时间（自动）
    updated_at = DateTime()               # 更新时间（自动）
    created_by = ForeignKey(User)         # 创建者
    
    # 索引
    Index('model_id', '-created_at')      # 查询模型测试历史
    Index('test_type', '-created_at')     # 查询按类型分类的测试
```

### SQL 查询示例

```sql
-- 查询某模型的所有测试
SELECT test_name, test_type, score, status, created_at
FROM models_manager_modeltestresult
WHERE model_id = 1
ORDER BY created_at DESC;

-- 查询通过的准确度测试
SELECT model_id, test_name, score
FROM models_manager_modeltestresult
WHERE test_type = 'accuracy' AND status = 'passed'
ORDER BY score DESC LIMIT 10;

-- 统计各测试类型的平均分
SELECT test_type, AVG(score) as avg_score, COUNT(*) as count
FROM models_manager_modeltestresult
WHERE status = 'passed'
GROUP BY test_type;
```

### JSON 数据格式

#### test_data 结构（输入）
```json
{
  "dataset": "ImageNet",
  "subset_size": 50000,
  "batch_size": 256,
  "version": "2025-Q1"
}
```

#### metrics 结构（输出）
```json
{
  "precision": 0.945,
  "recall": 0.942,
  "f1_score": 0.9435,
  "top_1_accuracy": 0.945,
  "top_5_accuracy": 0.998,
  "macro_averaged_precision": 0.940,
  "execution_time_seconds": 3600,
  "gpu_memory_gb": 24,
  "notes": "在 V100 GPU 上运行"
}
```

### API 创建测试结果

```bash
# 创建新的测试结果
curl -X POST http://82.157.56.206/api/models/1/test-results/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "test_type": "accuracy",
    "test_name": "ImageNet Classification 2025-Q1",
    "description": "图像分类精度测试",
    "score": 94.5,
    "status": "passed",
    "test_data": {
      "dataset": "ImageNet",
      "version": "2025-Q1"
    },
    "metrics": {
      "precision": 0.945,
      "recall": 0.942,
      "f1_score": 0.9435
    }
  }'
```

### Django ORM 使用

```python
from models_manager.models import ModelTestResult, AIModel
from django.contrib.auth import get_user_model

User = get_user_model()

# 创建测试结果
model = AIModel.objects.get(id=1)
user = User.objects.get(username='admin')

test_result = ModelTestResult.objects.create(
    model=model,
    test_type='accuracy',
    test_name='ImageNet 2025-Q1',
    description='图像分类精度测试',
    score=94.5,
    status='passed',
    test_data={'dataset': 'ImageNet', 'subset_size': 50000},
    metrics={'precision': 0.945, 'recall': 0.942, 'f1_score': 0.9435},
    created_by=user
)

# 查询测试结果
# 某模型的所有测试
tests = ModelTestResult.objects.filter(model=model).order_by('-created_at')

# 通过的准确度测试
passed_tests = ModelTestResult.objects.filter(
    test_type='accuracy',
    status='passed'
).order_by('-score')

# 统计平均分
from django.db.models import Avg
avg_scores = ModelTestResult.objects.filter(
    status='passed'
).values('test_type').annotate(avg_score=Avg('score'))

# 更新测试状态
test_result.status = 'passed'
test_result.score = 95.2
test_result.save()
```

---

## 排行榜快照 (LeaderboardSnapshot)

### 表信息
- **表名**: `models_manager_leaderboardsnapshot`
- **用途**: 存储排行榜的历史快照
- **记录数**: 0 (新表，待数据)
- **索引数**: 2个

### 数据字段

```python
class LeaderboardSnapshot(models.Model):
    snapshot_date = DateTime()            # 快照时间（自动）
    leaderboard_data = JSONField()        # 完整排行榜数据（列表）
    total_models = IntegerField()         # 活跃模型总数
    total_battles = IntegerField()        # 总对战数
    
    # 索引
    Index('-snapshot_date')               # 快速查询最新快照
```

### SQL 查询示例

```sql
-- 查询最新的排行榜快照
SELECT snapshot_date, total_models, total_battles
FROM models_manager_leaderboardsnapshot
ORDER BY snapshot_date DESC LIMIT 1;

-- 查询最近7天的快照（用于趋势分析）
SELECT snapshot_date, total_models, total_battles
FROM models_manager_leaderboardsnapshot
WHERE snapshot_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
ORDER BY snapshot_date DESC;

-- 统计排行榜变化
SELECT 
    DATE(snapshot_date) as date,
    MAX(total_models) as max_models,
    AVG(total_battles) as avg_battles_per_day
FROM models_manager_leaderboardsnapshot
WHERE snapshot_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY DATE(snapshot_date)
ORDER BY date DESC;
```

### JSON 数据格式

#### leaderboard_data 结构

```json
[
  {
    "rank": 1,
    "model_id": 15,
    "model_name": "GPT-4-Turbo",
    "display_name": "OpenAI GPT-4 Turbo",
    "owner": "OpenAI",
    "elo_rating": 2450,
    "wins": 145,
    "losses": 32,
    "draws": 8,
    "total_battles": 185,
    "win_rate": 0.7838,
    "change": "+15",
    "trend": "↑",
    "is_active": true,
    "last_battle": "2025-12-08T08:30:00Z"
  },
  {
    "rank": 2,
    "model_id": 22,
    "model_name": "Claude-3-Opus",
    "display_name": "Anthropic Claude 3 Opus",
    "owner": "Anthropic",
    "elo_rating": 2380,
    "wins": 138,
    "losses": 41,
    "draws": 5,
    "total_battles": 184,
    "win_rate": 0.75,
    "change": "+5",
    "trend": "→",
    "is_active": true,
    "last_battle": "2025-12-08T09:15:00Z"
  }
]
```

### API 创建快照

```bash
# 创建新的排行榜快照
curl -X POST http://82.157.56.206/api/leaderboard-snapshots/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "total_models": 42,
    "total_battles": 1250,
    "leaderboard_data": [
      {
        "rank": 1,
        "model_id": 15,
        "model_name": "GPT-4-Turbo",
        "elo_rating": 2450,
        "wins": 145,
        "losses": 32,
        "win_rate": 0.7838
      }
    ]
  }'
```

### Django ORM 使用

```python
from models_manager.models import LeaderboardSnapshot, AIModel

# 创建快照
leaderboard_data = []
models = AIModel.objects.filter(is_active=True).order_by('-elo_rating')

for rank, model in enumerate(models, 1):
    leaderboard_data.append({
        'rank': rank,
        'model_id': model.id,
        'model_name': model.name,
        'elo_rating': model.elo_rating,
        'wins': model.wins,
        'losses': model.losses,
        'total_battles': model.total_battles,
        'win_rate': model.wins / model.total_battles if model.total_battles > 0 else 0
    })

snapshot = LeaderboardSnapshot.objects.create(
    total_models=len(leaderboard_data),
    total_battles=sum(m['total_battles'] for m in leaderboard_data),
    leaderboard_data=leaderboard_data
)

# 查询快照
# 最新快照
latest = LeaderboardSnapshot.objects.latest('snapshot_date')

# 最近7天的快照
from datetime import timedelta
from django.utils import timezone

week_ago = timezone.now() - timedelta(days=7)
recent = LeaderboardSnapshot.objects.filter(
    snapshot_date__gte=week_ago
).order_by('-snapshot_date')

# 提取特定模型的排名变化
for snapshot in recent:
    for item in snapshot.leaderboard_data:
        if item['model_id'] == 15:
            print(f"{snapshot.snapshot_date}: Rank {item['rank']}, ELO {item['elo_rating']}")
```

### 定时任务：生成每日快照

```python
# backend/models_manager/tasks.py
from celery import shared_task
from django.utils import timezone
from .models import AIModel, LeaderboardSnapshot

@shared_task
def create_daily_leaderboard_snapshot():
    """生成每日排行榜快照（建议在每天 00:00 执行）"""
    
    leaderboard_data = []
    models = AIModel.objects.filter(is_active=True).order_by('-elo_rating')
    
    for rank, model in enumerate(models, 1):
        leaderboard_data.append({
            'rank': rank,
            'model_id': model.id,
            'model_name': model.name,
            'display_name': model.display_name,
            'owner': model.creator.username if model.creator else 'Unknown',
            'elo_rating': float(model.elo_rating),
            'wins': model.wins,
            'losses': model.losses,
            'draws': model.draws,
            'total_battles': model.total_battles,
            'win_rate': round(model.wins / model.total_battles, 4) if model.total_battles > 0 else 0,
            'is_active': model.is_active,
            'last_updated': model.updated_at.isoformat()
        })
    
    total_battles = sum(m['total_battles'] for m in leaderboard_data)
    
    snapshot = LeaderboardSnapshot.objects.create(
        total_models=len(leaderboard_data),
        total_battles=total_battles,
        leaderboard_data=leaderboard_data
    )
    
    return f"快照 #{snapshot.id} 已创建，包含 {len(leaderboard_data)} 个模型"

# 在 celery beat 中配置（settings.py）
CELERY_BEAT_SCHEDULE = {
    'create-daily-leaderboard-snapshot': {
        'task': 'models_manager.tasks.create_daily_leaderboard_snapshot',
        'schedule': crontab(hour=0, minute=0),  # 每天午夜
    },
}
```

---

## 迁移信息

### 已应用的迁移

```
forum:
  0001_initial.py
  0002_remove_forumsharelog_post_remove_forumsharelog_user_and_more.py
  0003_forumpostfavorite_forumpostviewhistory_and_more.py (✨ 新增：12个索引)

models_manager:
  0001_initial.py
  0002_aimodel.py
  0003_leaderboardsnapshot_modeltestresult.py (✨ 新增：2个模型)
```

### 数据库表创建

两个新表已成功创建：

```sql
-- 模型测试结果表
CREATE TABLE models_manager_modeltestresult (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  model_id BIGINT NOT NULL,
  test_type VARCHAR(50) NOT NULL,
  test_name VARCHAR(255) NOT NULL,
  description LONGTEXT,
  test_data JSON NOT NULL DEFAULT '{}',
  score DOUBLE NOT NULL,
  metrics JSON NOT NULL DEFAULT '{}',
  status VARCHAR(20) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by_id BIGINT,
  FOREIGN KEY (model_id) REFERENCES models_manager_aimodel(id),
  FOREIGN KEY (created_by_id) REFERENCES users_user(id),
  INDEX idx_model_created (model_id, created_at DESC),
  INDEX idx_test_type_created (test_type, created_at DESC)
) ENGINE=InnoDB CHARSET=utf8mb4;

-- 排行榜快照表
CREATE TABLE models_manager_leaderboardsnapshot (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  snapshot_date DATETIME(6) NOT NULL,
  leaderboard_data JSON NOT NULL DEFAULT '[]',
  total_models INT NOT NULL,
  total_battles INT NOT NULL,
  INDEX idx_snapshot_date (snapshot_date DESC)
) ENGINE=InnoDB CHARSET=utf8mb4;
```

---

## 验证清单

- [x] 两个新表已创建
- [x] 外键约束已建立
- [x] 索引已优化
- [x] 数据库健康检查通过
- [x] 读写功能测试通过
- [x] Django ORM 模型已定义
- [x] 迁移文件已生成

---

**最后更新**: 2025-12-08  
**版本**: 1.0  
**状态**: ✅ 完成并验证
