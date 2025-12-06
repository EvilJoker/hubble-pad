# 多阶段构建：构建阶段
FROM node:20-alpine AS builder

# 配置构建参数（npm 镜像源和代理设置）
ARG NPM_REGISTRY=https://registry.npmmirror.com
ARG NPM_PROXY=
ARG NPM_HTTPS_PROXY=
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG http_proxy
ARG https_proxy
ARG NO_PROXY
ARG no_proxy

# 设置 npm 镜像源
ENV npm_config_registry=${NPM_REGISTRY} \
    npm_config_progress=true

# 设置构建时的环境变量（代理设置）
ENV HTTP_PROXY=${HTTP_PROXY:-${NPM_PROXY}}
ENV HTTPS_PROXY=${HTTPS_PROXY:-${NPM_HTTPS_PROXY}}
ENV http_proxy=${http_proxy:-${NPM_PROXY}}
ENV https_proxy=${https_proxy:-${NPM_HTTPS_PROXY}}
ENV NO_PROXY=${NO_PROXY}
ENV no_proxy=${no_proxy}

WORKDIR /app

# 复制 package 文件和 lock 文件
COPY package*.json package-lock.json* ./
COPY web/package*.json web/package-lock.json* ./web/

# 安装所有依赖（包括 devDependencies）
# 使用 shell 来条件设置代理
RUN if [ -n "$NPM_PROXY" ]; then \
        export npm_config_proxy="$NPM_PROXY" && \
        export npm_config_https_proxy="$NPM_HTTPS_PROXY" && \
        export HTTP_PROXY="$NPM_PROXY" && \
        export HTTPS_PROXY="$NPM_HTTPS_PROXY" && \
        export http_proxy="$NPM_PROXY" && \
        export https_proxy="$NPM_HTTPS_PROXY" && \
        npm ci --loglevel=verbose; \
    else \
        npm ci --loglevel=verbose; \
    fi

RUN if [ -n "$NPM_PROXY" ]; then \
        export npm_config_proxy="$NPM_PROXY" && \
        export npm_config_https_proxy="$NPM_HTTPS_PROXY" && \
        export HTTP_PROXY="$NPM_PROXY" && \
        export HTTPS_PROXY="$NPM_HTTPS_PROXY" && \
        export http_proxy="$NPM_PROXY" && \
        export https_proxy="$NPM_HTTPS_PROXY" && \
        cd web && npm ci --loglevel=verbose && cd ..; \
    else \
        cd web && npm ci --loglevel=verbose && cd ..; \
    fi

# 复制源代码
COPY . .

# 构建前端
RUN npm run build

# 运行阶段
FROM node:20-alpine AS runner

# 配置构建参数（npm 镜像源和代理设置）
ARG NPM_REGISTRY=https://registry.npmmirror.com
ARG NPM_PROXY=
ARG NPM_HTTPS_PROXY=
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG http_proxy
ARG https_proxy
ARG NO_PROXY
ARG no_proxy

# 设置 npm 镜像源
ENV npm_config_registry=${NPM_REGISTRY} \
    npm_config_progress=true

# 设置构建时的环境变量（用于 apk 安装）
ENV HTTP_PROXY=${HTTP_PROXY:-${NPM_PROXY}}
ENV HTTPS_PROXY=${HTTPS_PROXY:-${NPM_HTTPS_PROXY}}
ENV http_proxy=${http_proxy:-${NPM_PROXY}}
ENV https_proxy=${https_proxy:-${NPM_HTTPS_PROXY}}
ENV NO_PROXY=${NO_PROXY}
ENV no_proxy=${no_proxy}

WORKDIR /app

# 安装 bash、python3 和常用工具
RUN apk add --no-cache \
    bash \
    python3 \
    py3-pip \
    curl \
    jq \
    && ln -sf python3 /usr/bin/python \
    && ln -sf pip3 /usr/bin/pip

# 复制并安装 Python 依赖
COPY docker/requirements.txt /tmp/requirements.txt
RUN pip install --break-system-packages --no-cache-dir -r /tmp/requirements.txt && \
    rm /tmp/requirements.txt

# 复制 package 文件和 lock 文件
COPY package*.json package-lock.json* ./

# 只安装生产依赖（使用 shell 来条件设置代理）
RUN if [ -n "$NPM_PROXY" ]; then \
        export npm_config_proxy="$NPM_PROXY" && \
        export npm_config_https_proxy="$NPM_HTTPS_PROXY" && \
        export HTTP_PROXY="$NPM_PROXY" && \
        export HTTPS_PROXY="$NPM_HTTPS_PROXY" && \
        export http_proxy="$NPM_PROXY" && \
        export https_proxy="$NPM_HTTPS_PROXY" && \
        npm ci --only=production --loglevel=verbose && npm cache clean --force; \
    else \
        npm ci --only=production --loglevel=verbose && npm cache clean --force; \
    fi

# 从构建阶段复制构建产物和 node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/node_modules ./node_modules

# 创建数据目录（root 下创建，使用 root 运行）
RUN mkdir -p /app/data

# 设置环境变量
ENV PORT=10002
ENV HUBBLE_PAD_DATA_DIR=/app/data
ENV NODE_ENV=production

# 暴露端口
EXPOSE 10002

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:10002/api/config', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 启动服务
CMD ["npm", "start"]

