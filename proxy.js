import { createProxyMiddleware } from 'http-proxy-middleware';

export default function handler(req, res) {
  const target = req.query.url;
  if (!target) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }
  const proxy = createProxyMiddleware({ target, changeOrigin: true });
  proxy(req, res);
}
