const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  console.log('[setupProxy] Configuring proxy middleware');
  console.log('[setupProxy] Integration routes -> http://localhost:8001');
  
  // Proxy integration routes directly to backend service (port 8001)
  app.use(
    '/api/integrations',
    createProxyMiddleware({
      target: 'http://localhost:8001',
      changeOrigin: true,
      logLevel: 'debug',
      onProxyReq: (proxyReq, req, res) => {
        console.log(`[Proxy-Integration] ${req.method} ${req.path} -> http://localhost:8001${req.path}`);
      },
      onProxyRes: (proxyRes, req, res) => {
        console.log(`[Proxy-Integration] Response: ${proxyRes.statusCode} for ${req.path}`);
      },
      onError: (err, req, res) => {
        console.error(`[Proxy-Integration Error] ${req.method} ${req.path}:`, err.message);
        res.status(503).json({
          error: 'Service Unavailable',
          message: err.message,
          detail: 'Failed to connect to Backend Service on port 8001'
        });
      }
    })
  );
  
  // Proxy other /api requests to API Gateway (port 8000) if needed
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:8000',
      changeOrigin: true,
      logLevel: 'debug',
      onProxyReq: (proxyReq, req, res) => {
        console.log(`[Proxy-Gateway] ${req.method} ${req.path} -> http://localhost:8000${req.path}`);
      },
      onProxyRes: (proxyRes, req, res) => {
        console.log(`[Proxy-Gateway] Response: ${proxyRes.statusCode} for ${req.path}`);
      },
      onError: (err, req, res) => {
        console.error(`[Proxy-Gateway Error] ${req.method} ${req.path}:`, err.message);
        res.status(503).json({
          error: 'Service Unavailable',
          message: err.message,
          detail: 'Failed to connect to API Gateway on port 8000'
        });
      }
    })
  );
  
  console.log('[setupProxy] Proxy middleware configured:');
  console.log('  - /api/integrations/* -> http://localhost:8001 (Backend Service)');
  console.log('  - /api/* -> http://localhost:8000 (API Gateway)');
};
