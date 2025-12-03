FROM python:3.12

# 关键：在 apt-get update 之前，先用 sed 命令替换软件源为国内镜像
# 将 bash 的安装合并到这一行
RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update && apt-get install -y netcat-openbsd libmagic1 bash dos2unix

WORKDIR /app
COPY requirements.txt .
# 使用国内镜像源加速 pip install
RUN pip install -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt
# 安装 Pillow 库以支持 ImageField
RUN pip install -i https://pypi.tuna.tsinghua.edu.cn/simple Pillow

# 单独复制等待脚本并赋予执行权限
COPY ./wait-for-db.sh .
RUN chmod +x ./wait-for-db.sh

COPY . .
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
