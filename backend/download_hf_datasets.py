import os
from datasets import load_dataset

# 定义要下载的数据集和目标文件名
# 格式: "hugging_face_id": "output_filename.csv"
DATASETS_TO_DOWNLOAD = {
    "rotten_tomatoes": "rotten_tomatoes.csv",
    "openai/gsm8k": "gsm8k.csv", # 也可以保留，供以后使用
}

# 定义输出目录
output_dir = "dataset_files" 
os.makedirs(output_dir, exist_ok=True)

def download_and_save_as_csv(dataset_id, output_filename):
    """下载数据集并将其保存为 CSV 文件"""
    print(f"开始下载数据集: {dataset_id}...")
    
    try:
        # 加载数据集的 'test' 部分
        dataset = load_dataset(dataset_id, split='test')
        
        # 适配不同数据集的列名
        prompt_column = None
        if 'question' in dataset.column_names:
            prompt_column = 'question'
        elif 'text' in dataset.column_names:
            prompt_column = 'text'
        
        if not prompt_column:
            print(f"错误: 数据集 {dataset_id} 缺少 'question' 或 'text' 列。")
            return

        # 为了统一格式，我们只保留 prompt 列，并重命名为 'prompt'
        dataset = dataset.rename_column(prompt_column, 'prompt')
        dataset = dataset.remove_columns([col for col in dataset.column_names if col != 'prompt'])

        # 构建完整的输出路径
        output_path = os.path.join(output_dir, output_filename)
        
        # 保存为 CSV 文件
        dataset.to_csv(output_path)
        
        print(f"成功！数据集已保存到: {output_path}")

    except Exception as e:
        print(f"下载或处理数据集 {dataset_id} 时出错: {e}")


if __name__ == "__main__":
    for hf_id, filename in DATASETS_TO_DOWNLOAD.items():
        download_and_save_as_csv(hf_id, filename)
