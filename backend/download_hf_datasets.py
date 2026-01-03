import os
import re
from datasets import load_dataset
import pandas as pd

# --- 辅助函数，用于从 solution 文本中提取 boxed 答案 ---
def extract_boxed_answer(text: str) -> str | None:
    """
    使用正则表达式从文本中提取 \\boxed{...} 里的内容。
    """
    if not isinstance(text, str):
        return None
    # re.DOTALL 使得 '.' 可以匹配包括换行符在内的任意字符
    match = re.search(r"\\boxed{(.+?)}", text, re.DOTALL)
    if match:
        return match.group(1).strip()
    return None

# --- 定义要下载的数据集 ---
# 新增 'preprocess' 键来指定预处理函数
DATASETS_TO_DOWNLOAD = {
    # --- 现有数据集 (10个) ---
    "openai/gsm8k": {"name": "main", "split": "test", "filename": "gsm8k.csv"},
    "rotten_tomatoes": {"name": None, "split": "test", "filename": "rotten_tomatoes.csv"},
    "HuggingFaceH4/MATH-500": {"name": None, "split": "test", "filename": "MATH-500.csv"},
    "DigitalLearningGmbH/MATH-lighteval": {"name": None, "split": "test", "filename": "MATH-lighteval.csv", "preprocess": "unify_boxed_math"},
    "EleutherAI/hendrycks_math": {"name": None, "split": "test", "filename": "hendrycks_math.csv"},
    "Etau/commonsense_qa": {"name": None, "split": "test", "filename": "commonsense_qa.csv"},
    "fancyzhx/ag_news": {"name": None, "split": "test", "filename": "ag_news.csv"},
    "gimmaru/glue-sst2": {"name": None, "split": "test", "filename": "glue-sst2.csv"},
    "stanford/squad": {"name": None, "split": "validation", "filename": "squad.csv", "preprocess": "unify_squad"},
    "samsum": {"name": None, "split": "test", "filename": "samsum.csv", "preprocess": "unify_samsum"},

    # --- 新增数据集 (6个)，总数达到16个 ---
    "xsum": {
        "name": None,
        "split": "test",
        "filename": "xsum.csv",
        "preprocess": "unify_xsum"
    },
    "google/boolq": {
        "name": None,
        "split": "train[:1000]", # 验证集太小，从训练集取1000条
        "filename": "boolq.csv",
        "preprocess": "unify_boolq"
    },
    "imdb": {
        "name": None,
        "split": "test",
        "filename": "imdb.csv" # 格式正确，无需处理
    },
    "multi_nli": {
        "name": None,
        "split": "validation_matched",
        "filename": "multi_nli.csv",
        "preprocess": "unify_multi_nli"
    },
    "wmt16": {
        "name": "de-en",
        "split": "test",
        "filename": "wmt16_de_en.csv",
        "preprocess": "unify_wmt16_de_en"
    },
    "openai_humaneval": {
        "name": None,
        "split": "test",
        "filename": "humaneval.csv",
        "preprocess": "unify_humaneval"
    },
}

output_dir = "dataset_files"
os.makedirs(output_dir, exist_ok=True)

# --- 预处理函数字典 ---
def unify_boxed_math_preprocessor(dataset):
    """
    将包含 \boxed{} 答案的数据集转换为统一格式。
    """
    print("  -> 正在应用 'unify_boxed_math' 预处理...")
    # 将 Hugging Face Dataset 转换为 pandas DataFrame 以便处理
    df = dataset.to_pandas()
    
    # 从 'solution' 列提取答案到新的 'answer' 列
    df['answer'] = df['solution'].apply(extract_boxed_answer)
    
    # 筛选出成功提取到答案的行
    original_rows = len(df)
    df.dropna(subset=['answer'], inplace=True)
    processed_rows = len(df)
    print(f"     成功从 {processed_rows} / {original_rows} 行中提取了答案。")
    
    # 为了与 MATH-500.csv 格式更接近，重命名列
    if 'type' in df.columns:
        df.rename(columns={'type': 'subject'}, inplace=True)
        
    return df

def unify_squad_preprocessor(dataset):
    """
    处理 SQuAD (Stanford Question Answering Dataset) 数据集。
    - 将 context 和 question 合并为 'prompt'。
    - 从复杂的 'answers' 结构中提取第一个答案作为 'answer'。
    """
    print("  -> 正在应用 'unify_squad' 预处理...")
    df = dataset.to_pandas()

    # 提取第一个答案文本
    df['answer'] = df['answers'].apply(lambda x: x['text'][0] if x['text'] else None)
    
    # 将 context 和 question 合并为 prompt
    df['prompt'] = "Context: " + df['context'] + "\n\nQuestion: " + df['question'] + "\n\nAnswer:"

    # 删除不再需要的原始列，并筛选有效行
    df.drop(columns=['id', 'title', 'context', 'question', 'answers'], inplace=True)
    df.dropna(subset=['prompt', 'answer'], inplace=True)
    
    return df

def unify_samsum_preprocessor(dataset):
    """
    处理 SAMSum (对话摘要) 数据集。
    - 将 'dialogue' 列重命名为 'prompt'。
    - 将 'summary' 列重命名为 'answer'。
    """
    print("  -> 正在应用 'unify_samsum' 预处理...")
    df = dataset.to_pandas()
    df.rename(columns={'dialogue': 'prompt', 'summary': 'answer'}, inplace=True)
    df.drop(columns=['id'], inplace=True)
    
    return df

def unify_xsum_preprocessor(dataset):
    """处理 XSum (新闻摘要) 数据集。"""
    print("  -> 正在应用 'unify_xsum' 预处理...")
    df = dataset.to_pandas()
    df.rename(columns={'document': 'prompt', 'summary': 'answer'}, inplace=True)
    df.drop(columns=['id'], inplace=True)
    return df

def unify_boolq_preprocessor(dataset):
    """处理 BoolQ (是/否问答) 数据集。"""
    print("  -> 正在应用 'unify_boolq' 预处理...")
    df = dataset.to_pandas()
    df['prompt'] = "Passage: " + df['passage'] + "\n\nQuestion: " + df['question'] + "\n\nAnswer (yes or no):"
    df['answer'] = df['answer'].apply(lambda x: 'yes' if x else 'no')
    df.drop(columns=['passage', 'question'], inplace=True)
    return df

def unify_multi_nli_preprocessor(dataset):
    """处理 MultiNLI (自然语言推断) 数据集。"""
    print("  -> 正在应用 'unify_multi_nli' 预处理...")
    df = dataset.to_pandas()
    df['prompt'] = "Premise: " + df['premise'] + "\n\nHypothesis: " + df['hypothesis']
    df.rename(columns={'prompt': 'text'}, inplace=True) # 适配分类任务
    df = df[['text', 'label']]
    df = df[df['label'] != -1] # 移除无效标签
    return df

def unify_wmt16_de_en_preprocessor(dataset):
    """处理 WMT16 (德语->英语翻译) 数据集。"""
    print("  -> 正在应用 'unify_wmt16_de_en' 预处理...")
    df = dataset.to_pandas()
    df['prompt'] = df['translation'].apply(lambda x: x['de'])
    df['answer'] = df['translation'].apply(lambda x: x['en'])
    df = df[['prompt', 'answer']]
    return df

def unify_humaneval_preprocessor(dataset):
    """处理 HumanEval (代码生成) 数据集。"""
    print("  -> 正在应用 'unify_humaneval' 预处理...")
    df = dataset.to_pandas()
    df.rename(columns={'canonical_solution': 'answer'}, inplace=True)
    df = df[['prompt', 'answer', 'test']]
    return df

# 将预处理函数的名称映射到实际的函数
PREPROCESSORS = {
    "unify_boxed_math": unify_boxed_math_preprocessor,
    "unify_squad": unify_squad_preprocessor,
    "unify_samsum": unify_samsum_preprocessor,
    "unify_xsum": unify_xsum_preprocessor,
    "unify_boolq": unify_boolq_preprocessor,
    "unify_multi_nli": unify_multi_nli_preprocessor,
    "unify_wmt16_de_en": unify_wmt16_de_en_preprocessor,
    "unify_humaneval": unify_humaneval_preprocessor,
}


def download_and_save(dataset_id, config):
    print(f"开始下载数据集: {dataset_id}...")
    try:
        # 加载数据集
        dataset = load_dataset(dataset_id, name=config.get("name"), split=config.get("split"))
        
        output_path = os.path.join(output_dir, config["filename"])
        
        # --- 关键修改: 检查是否需要预处理 ---
        preprocess_func_name = config.get("preprocess")
        if preprocess_func_name and preprocess_func_name in PREPROCESSORS:
            # 获取并调用指定的预处理函数
            processor = PREPROCESSORS[preprocess_func_name]
            processed_df = processor(dataset)
            # 将处理后的 DataFrame 保存为 CSV
            processed_df.to_csv(output_path, index=False)
        else:
            # 如果不需要处理，直接保存为 CSV
            dataset.to_csv(output_path, index=False)
        
        print(f"成功！数据集已保存到: {output_path}")
    except Exception as e:
        print(f"下载或处理数据集 {dataset_id} 时出错: {e}")

if __name__ == "__main__":
    for hf_id, conf in DATASETS_TO_DOWNLOAD.items():
        download_and_save(hf_id, conf)