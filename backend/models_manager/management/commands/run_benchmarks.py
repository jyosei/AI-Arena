import os
import csv
import re
from django.conf import settings
from django.core.management.base import BaseCommand
from models_manager.models import AIModel, BenchmarkScore
# 关键修改：导入测评专用的服务工厂函数
from models_manager.services import get_evaluation_model_service 
from sympy import sympify, simplify

# --- 智能答案校验函数 (这部分保持不变) ---
def check_answer(model_answer, correct_answer):
    """
    更智能的答案校验函数，用于处理数学问题。
    """
    # 1. 预处理：移除 LaTeX 的 \text{} 和 \boxed{} 等常见宏
    model_answer = re.sub(r'\\text\{.*?\}', '', str(model_answer))
    model_answer = re.sub(r'\\boxed\{(.*?)\}', r'\1', model_answer)
    correct_answer = re.sub(r'\\boxed\{(.*?)\}', r'\1', str(correct_answer))

    # 2. 尝试使用 SymPy 进行符号比较
    try:
        model_expr = sympify(model_answer)
        correct_expr = sympify(correct_answer)
        if simplify(model_expr - correct_expr) == 0:
            return True
    except (SyntaxError, TypeError, ValueError, Exception):
        pass

    # 3. 回退：提取数字和关键文本进行比较
    model_answer_clean = re.sub(r'[\s,]', '', model_answer).lower()
    correct_answer_clean = re.sub(r'[\s,]', '', correct_answer).lower()
    if model_answer_clean == correct_answer_clean:
        return True
    model_numbers = re.findall(r'-?\d+\.?\d*', model_answer)
    correct_numbers = re.findall(r'-?\d+\.?\d*', correct_answer)
    if model_numbers and correct_numbers and model_numbers == correct_numbers:
        return True

    return False

def load_benchmark_questions_from_csv(filename="MATH-500.csv"):
    """从CSV文件加载和解析评测问题。"""
    questions = {}
    file_path = os.path.join(settings.BASE_DIR, 'dataset_files', filename)
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                subject = row.get('subject', 'General')
                problem_text = row.get('problem', '')
                
                # 清理问题文本：移除 [asy] ... [/asy] 代码块
                clean_problem = re.sub(r'\[asy\].*?\[/asy\]', '', problem_text, flags=re.DOTALL).strip()

                if subject not in questions:
                    questions[subject] = []
                
                questions[subject].append({
                    'prompt': clean_problem,
                    'answer': row.get('answer', '')
                })
        return questions
    except FileNotFoundError:
        print(f"错误: 数据集文件未找到 at {file_path}")
        return {}


class Command(BaseCommand):
    help = 'Runs a one-time benchmark evaluation for all models using a CSV dataset.'

    def handle(self, *args, **options):
        self.stdout.write("开始从 CSV 文件加载评测题目...")
        
        BENCHMARK_QUESTIONS = load_benchmark_questions_from_csv()
        if not BENCHMARK_QUESTIONS:
            self.stderr.write("加载题目失败，评测中止。")
            return

        # 从环境变量获取 API Key，这是最佳实践
        API_KEY = os.getenv("OPENAI_API_KEY")
        if not API_KEY:
            self.stderr.write("错误: 环境变量 OPENAI_API_KEY 未设置。")
            return

        self.stdout.write("题目加载完成，开始进行客观基准测评...")

        # --- 修改这里 ---
        # 原来的代码:
        # models_to_test = AIModel.objects.filter(is_active=True)
        
        # 修改后的代码：只测试 gpt-4o 和 claude-3-opus-20240229
        target_models = ["gpt-4"]
        models_to_test = AIModel.objects.filter(name__in=target_models, is_active=True)
        self.stdout.write(self.style.WARNING(f"注意：当前处于测试模式，只评测以下模型: {target_models}"))
        # --- 修改结束 ---

        BenchmarkScore.objects.all().delete()
        self.stdout.write("已清空旧的评测结果。")

        for model in models_to_test:
            self.stdout.write(f"\n正在评测模型: {model.name}")
            
            # --- 核心修改：在循环内部为每个模型获取对应的服务实例 ---
            try:
                evaluation_service = get_evaluation_model_service(model_name=model.name, api_key=API_KEY)
            except ValueError as e:
                self.stderr.write(f"无法为模型 {model.name} 获取服务: {e}。跳过此模型。")
                continue
            # ---------------------------------------------------------

            category_scores = {}
            total_correct = 0
            total_questions = 0

            for category, questions in BENCHMARK_QUESTIONS.items():
                correct_count = 0
                self.stdout.write(f"  -> 评测维度: {category} ({len(questions)} 题)")
                
                questions_to_run = questions[:5] # 为节省时间，只取前5题

                for i, q in enumerate(questions_to_run):
                    try:
                        # 使用获取到的专属服务进行评测
                        model_answer = evaluation_service.evaluate(prompt=q['prompt'], model_name=model.name)
                        
                        if "API_ERROR" in model_answer:
                            self.stderr.write(f"    - 调用模型 API 出错: {model_answer}")
                            continue

                        if check_answer(model_answer, q['answer']):
                            correct_count += 1
                        
                        self.stdout.write(f"    - 问题 {i+1}/{len(questions_to_run)} ... 完成")

                    except Exception as e:
                        self.stderr.write(f"    - 调用模型 {model.name} 时发生未知错误: {e}")
                
                accuracy = (correct_count / len(questions_to_run)) * 100 if questions_to_run else 0
                category_scores[category] = round(accuracy, 2)
                total_correct += correct_count
                total_questions += len(questions_to_run)

            total_score = (total_correct / total_questions) * 100 if total_questions else 0
            
            BenchmarkScore.objects.create(
                model=model,
                total_score=round(total_score, 2),
                scores=category_scores
            )
            self.stdout.write(self.style.SUCCESS(f"模型 {model.name} 评测完成! 总分: {total_score:.2f}"))

        self.stdout.write(self.style.SUCCESS("\n所有模型评测完毕！"))
