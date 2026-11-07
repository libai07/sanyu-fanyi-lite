# 三语翻译 · Lite

## 使用方法

1. 将本项目的 `public/`、`functions/` 和 `wrangler.toml` 上传到 GitHub 仓库。
2. 在 Cloudflare Pages 中连接该仓库，设置：
   - Build command：留空
   - Build output directory：`public`
   - Root directory：留空
3. 部署完成后，进入 **Settings → Variables and Secrets → Production**，添加：
   - `NVIDIA_API_KEY`：你的 NVIDIA NIM API Key（类型选择 Secret）
4. （可选）创建 KV Namespace，在 Dashboard 中绑定变量 `RATE_LIMIT_KV`，启用分布式限流。
5. 重新部署项目，打开 Pages 提供的域名即可使用。
6. 输入或粘贴文本（单次最多 20,000 字符），停止输入 0.75 秒后自动翻译，或点击翻译按钮。
7. 点击译文卡片或「复制」按钮可复制对应语言译文。

如需排查错误，可在 Cloudflare 的 **Pages Functions Logs / Workers Logs** 中查看运行日志。