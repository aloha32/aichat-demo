# AI Chatbox Demo

一个基于 Next.js 16 + React 19 + TypeScript 的 Web AI Chatbox MVP，核心体验参考 ChatGPT，包含多轮对话、流式回复、多会话、本地历史记录、测试 API 和 OpenAI 兼容接口接入。

## 已实现能力

- 多轮聊天与流式回复
- 左侧会话列表、新建会话、会话切换
- 浏览器 `localStorage` 持久化历史记录
- `POST /api/chat` 正式聊天接口
- `POST /api/test/chat` 测试接口，内置 demo key
- `GET /api/health` 健康检查接口
- `mock` provider 与 `openai-compatible` provider
- 单元测试与 Playwright E2E 测试

## 技术栈

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Zod
- OpenAI SDK
- Vitest
- Playwright

## 本地启动

1. 安装依赖

```bash
npm install
```

2. 复制环境变量

```bash
cp .env.example .env.local
```

3. 启动开发环境

```bash
npm run dev
```

默认访问地址：

```text
http://127.0.0.1:3000
```

如果需要指定端口：

```bash
npm run dev -- --hostname 127.0.0.1 --port 3100
```

## 环境变量

`.env.example` 已包含基础配置：

```env
AI_PROVIDER=mock
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
DEMO_API_KEY=demo-chat-key
MOCK_STREAM_DELAY_MS=16
```

说明：

- `AI_PROVIDER=mock` 时，前端和 API 可直接联调，不依赖真实模型。
- `AI_PROVIDER=openai-compatible` 时，服务端会走 OpenAI 兼容接口。
- `OPENAI_API_KEY` 仅在服务端读取，不会暴露到浏览器。
- `DEMO_API_KEY` 用于 `/api/test/chat` 的 Bearer Token，默认值为 `demo-chat-key`。

## 测试 API 调用示例

健康检查：

```bash
curl http://127.0.0.1:3000/api/health
```

测试聊天接口：

```bash
curl http://127.0.0.1:3000/api/test/chat \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer demo-chat-key" \
  -d '{
    "conversationId": "demo-conversation",
    "messages": [
      {
        "role": "user",
        "content": "Give me a launch checklist for an AI chat demo."
      }
    ]
  }'
```

正式聊天接口：

```bash
curl http://127.0.0.1:3000/api/chat \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "demo-conversation",
    "messages": [
      {
        "role": "user",
        "content": "Summarize the product goals."
      }
    ]
  }'
```

## 真实模型接入

如果要切换到真实的 OpenAI 兼容服务，更新 `.env.local`：

```env
AI_PROVIDER=openai-compatible
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=your-real-key
OPENAI_MODEL=gpt-4.1-mini
```

然后重启开发服务器。前端页面无需改动，会继续调用同一个 `/api/chat`，由服务端选择实际 provider。

## 测试命令

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:e2e
```

## 当前限制

- 本期没有登录、用户体系和服务端数据库持久化
- 本期没有文件上传、多模态和联网搜索
- OpenAI 兼容模式代码已实现，但是否能成功接入取决于你提供的真实 `BASE_URL / API_KEY / MODEL`
