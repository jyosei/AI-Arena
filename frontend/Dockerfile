# frontend/Dockerfile
FROM node:20-alpine AS build

WORKDIR /app

# 安装依赖
COPY package*.json ./
# 使用淘宝镜像源加速 npm install
RUN npm install --registry=https://registry.npmmirror.com

# 拷贝前端源码并构建
COPY . .
# 允许在构建时通过 build-arg 注入 Vite 环境变量 VITE_API_BASE
# 默认使用相对路径 '/api/'，使浏览器请求通过 nginx 反向代理到后端（避免浏览器直接访问容器名 'backend' 导致的网络错误）
ARG VITE_API_BASE=/api/
ENV VITE_API_BASE=${VITE_API_BASE}

# 构建（Vite 会把 import.meta.env.VITE_API_BASE 嵌入到构建产物）
RUN npm run build

# 部署阶段
# --- 关键修改：使用一个有效的 Nginx 镜像标签 ---
FROM nginx:alpine
# 拷贝构建好的前端文件
COPY --from=build /app/dist /usr/share/nginx/html
# 拷贝我们自定义的 Nginx 配置文件
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
