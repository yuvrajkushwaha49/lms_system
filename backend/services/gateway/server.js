const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { loadEnv, backendRoot } = require('../../shared/bootstrap');

loadEnv();
const { gatewayRoutes, gatewayPort } = require('../../shared/gateway-config');

const app = express();

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);
app.use(cors());
app.use(morgan('dev'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'api-gateway', mode: 'microservices' });
});

app.use('/uploads/feed-media', (req, res) => {
  res.status(404).json({ status: 'error', message: 'Feed media is served through protected URLs.' });
});
app.use('/uploads', express.static(path.join(backendRoot, 'uploads')));

gatewayRoutes.forEach(({ path: routePath, target, service }) => {
  app.use(
    routePath,
    createProxyMiddleware({
      target,
      changeOrigin: true,
      // Express mount strips routePath; services still expect full /api/... paths
      pathRewrite: (path) => `${routePath}${path}`,
      logLevel: 'warn',
      onError(err, req, res) {
        console.error(`[gateway] proxy error (${service}):`, err.message);
        if (!res.headersSent) {
          res.status(502).json({
            status: 'error',
            message: `Service unavailable: ${service}`,
          });
        }
      },
    }),
  );
});

app.use((req, res) => {
  res.status(404).json({ status: 'error', message: 'Route not found on API gateway' });
});

const port = Number(gatewayPort);
app.listen(port, () => {
  console.log(`[api-gateway] listening on port ${port}`);
  console.log('[api-gateway] proxying to microservices (shared MySQL)');
  gatewayRoutes.forEach(({ path: routePath, target }) => {
    console.log(`  ${routePath} -> ${target}`);
  });
});
