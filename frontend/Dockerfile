# frontend/Dockerfile
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install --registry=https://registry.npmmirror.com

COPY . ./

# --- 关键修改: 添加所有需要的环境变量 ---

# 1. API 基础路径
ARG VITE_API_BASE=/api/
ENV VITE_API_BASE=${VITE_API_BASE}

# 2. 公共访问地址
# 默认使用公网正式域名，构建时可覆盖
ARG VITE_PUBLIC_ORIGIN=http://82.157.56.206
ENV VITE_PUBLIC_ORIGIN=${VITE_PUBLIC_ORIGIN}

# 3. GitHub Client ID (这很可能是缺失的变量)
#    前端需要它来构建 GitHub 登录链接
#    从 docker-compose.yml 的 backend 服务中复制这个值
ARG VITE_GITHUB_CLIENT_ID=Ov23li8J7zm7OnqPEL02
ENV VITE_GITHUB_CLIENT_ID=${VITE_GITHUB_CLIENT_ID}

# 4. 【新增】后端服务地址 (用于拼接媒体文件 URL)
# 默认指向后端正式域名，构建时可覆盖
ARG VITE_BACKEND_ORIGIN=http://82.157.56.206
ENV VITE_BACKEND_ORIGIN=${VITE_BACKEND_ORIGIN}

# 构建（Vite 会把 import.meta.env.VITE_... 嵌入到构建产物）
# 添加 --debug 标志以获取更详细的构建日志
RUN npm run build -- --debug

# 部署阶段
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html

# nginx.conf 将通过 docker-compose.yml 的 volumes 挂载，这里不需要 COPY

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
