FROM python:3.12

# 只需要 netcat 用于 wait-for-db.sh 脚本
RUN apt-get update && apt-get install -y netcat-openbsd

WORKDIR /app
COPY requirements.txt .
# 使用国内镜像源加速 pip install
RUN pip install -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt

# 单独复制等待脚本并赋予执行权限
COPY ./wait-for-db.sh .
RUN chmod +x ./wait-for-db.sh

COPY . .
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
