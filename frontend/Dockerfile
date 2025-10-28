# frontend/Dockerfile
FROM node:20-alpine AS build

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm install

# 拷贝前端源码并构建
COPY . .
RUN npm run build

# 部署阶段
FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
