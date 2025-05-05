const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = (req, res) => {
  const target = req.query.url;
  if (!target) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }
  const proxy = createProxyMiddleware({
    target,
    changeOrigin: true,
    onError: (err, req, res) => {
      res.status(500).json({ error: 'Proxy error occurred' });
    }
  });
  proxy(req, res);
};

module.exports.config = {
  api: { bodyParser: false }
};
