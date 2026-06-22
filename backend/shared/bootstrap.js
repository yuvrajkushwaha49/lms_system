const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const backendRoot = path.join(__dirname, '..');

function loadEnv() {
  require('dotenv').config({ path: path.join(backendRoot, '.env') });
}

function connectDatabase() {
  require(path.join(backendRoot, 'config', 'db'));
}

function createServiceApp({ serviceName }) {
  const app = express();

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(morgan('dev'));

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: serviceName });
  });

  return app;
}

function attachErrorHandler(app, serviceName) {
  app.use((err, req, res, next) => {
    console.error(`[${serviceName}]`, err.stack || err);
    res.status(err.status || 500).json({
      status: 'error',
      message: err.message || 'Internal Server Error',
    });
  });
}

function startService(app, { serviceName, portEnv, defaultPort }) {
  const port = Number(process.env[portEnv] || defaultPort);
  app.listen(port, () => {
    console.log(`[${serviceName}] listening on port ${port}`);
  });
}

module.exports = {
  backendRoot,
  loadEnv,
  connectDatabase,
  createServiceApp,
  attachErrorHandler,
  startService,
};
