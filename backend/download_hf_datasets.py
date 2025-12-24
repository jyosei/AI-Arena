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
    "openai/gsm8k": {"name": "main", "split": "test", "filename": "gsm8k.csv"},
    "rotten_tomatoes": {"name": None, "split": "test", "filename": "rotten_tomatoes.csv"},
    "HuggingFaceH4/MATH-500": {"name": None, "split": "test", "filename": "MATH-500.csv"},
    # --- 关键修改: 为需要处理的数据集添加 'preprocess' 标志 ---
    "DigitalLearningGmbH/MATH-lighteval": {
        "name": None, 
        "split": "test", 
        "filename": "MATH-lighteval.csv", # 将保存为这个统一格式的文件名
        "preprocess": "unify_boxed_math" # 指定预处理函数的名称
    },
    "EleutherAI/hendrycks_math": {"name": None, "split": "test", "filename": "hendrycks_math.csv"},
    "Etau/commonsense_qa": {"name": None, "split": "test", "filename": "commonsense_qa.csv"},
    "fancyzhx/ag_news": {"name": None, "split": "test", "filename": "ag_news.csv"},
    "gimmaru/glue-sst2": {"name": None, "split": "test", "filename": "glue-sst2.csv"},
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

# 将预处理函数的名称映射到实际的函数
PREPROCESSORS = {
    "unify_boxed_math": unify_boxed_math_preprocessor,
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