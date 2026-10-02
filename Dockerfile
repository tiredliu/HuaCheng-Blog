# ---------------------------------------------------------------------------
# 多阶段构建：先在 Node 里做静态导出，再用 Nginx 兜住 out/ 目录
#
#   docker build -t hua-cheng-blog .
#   docker run -d --name blog -p 8080:80 hua-cheng-blog
#
# 想连 TinaCMS 后台一起打进去，就把 TinaCloud 的两个变量作为 build-arg 传进来：
#   docker build --build-arg NEXT_PUBLIC_TINA_CLIENT_ID=xxx \
#                --build-arg TINA_TOKEN=xxx -t hua-cheng-blog .
# ---------------------------------------------------------------------------

FROM node:22-alpine AS builder
WORKDIR /app

# 先只拷贝依赖清单，利用 Docker 层缓存：依赖没变就不重装
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# TinaCloud 凭据是可选的：没有就只导出前台（build:app），
# 有就顺带生成 public/admin 后台（build）
ARG NEXT_PUBLIC_TINA_CLIENT_ID=""
ARG TINA_TOKEN=""
ENV NEXT_PUBLIC_TINA_CLIENT_ID=$NEXT_PUBLIC_TINA_CLIENT_ID
ENV TINA_TOKEN=$TINA_TOKEN
ENV NEXT_TELEMETRY_DISABLED=1
RUN if [ -n "$TINA_TOKEN" ] && [ -n "$NEXT_PUBLIC_TINA_CLIENT_ID" ]; then \
      npm run build; \
    else \
      echo "未提供 TinaCloud 凭据，只导出前台静态页面"; \
      npm run build:app; \
    fi

# ---------------------------------------------------------------------------

FROM nginx:1.27-alpine AS runner

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/out /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q --spider http://127.0.0.1/ || exit 1
