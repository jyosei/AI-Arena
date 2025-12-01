import os
from datasets import load_dataset

# 定义要下载的数据集
DATASETS_TO_DOWNLOAD = {
    "openai/gsm8k": {"name": "main", "split": "test", "filename": "gsm8k.csv"},
    "rotten_tomatoes": {"name": None, "split": "test", "filename": "rotten_tomatoes.csv"},
}

output_dir = "dataset_files"
os.makedirs(output_dir, exist_ok=True)

def download_and_save(dataset_id, config):
    print(f"开始下载数据集: {dataset_id}...")
    try:
        # 加载数据集
        dataset = load_dataset(dataset_id, name=config.get("name"), split=config.get("split"))
        
        # 直接保存为 CSV，不进行任何列的修改
        output_path = os.path.join(output_dir, config["filename"])
        dataset.to_csv(output_path)
        
        print(f"成功！数据集已保存到: {output_path}")
    except Exception as e:
        print(f"下载或处理数据集 {dataset_id} 时出错: {e}")

if __name__ == "__main__":
    for hf_id, conf in DATASETS_TO_DOWNLOAD.items():
        download_and_save(hf_id, conf)