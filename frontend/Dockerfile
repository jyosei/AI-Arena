# frontend/Dockerfile
FROM node:20-alpine AS build

WORKDIR /app

# 安装依赖
COPY package*.json ./
# 使用淘宝镜像源加速 npm install
RUN npm install --registry=https://registry.npmmirror.com

# 拷贝前端源码并构建
COPY . .
RUN npm run build

# 部署阶段
FROM nginx:stable-alpine
# 拷贝构建好的前端文件
COPY --from=build /app/dist /usr/share/nginx/html
# 拷贝我们自定义的 Nginx 配置文件
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
