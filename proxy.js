import { createProxyMiddleware } from 'http-proxy-middleware';

export default function handler(req, res) {
  try {
    const target = req.query.url;
    if (!target) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }
    const proxy = createProxyMiddleware({
      target,
      changeOrigin: true,
      onError: (err, req, res) => {
        console.error('Proxy error:', err);
        res.status(500).json({ error: 'Proxy error occurred' });
      }
    });
    proxy(req, res);
  } catch (error) {
    console.error('Handler error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
