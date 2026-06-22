const { loadEnv, connectDatabase, createServiceApp, attachErrorHandler, startService } = require('../../shared/bootstrap');

loadEnv();
connectDatabase();

const app = createServiceApp({ serviceName: 'payment-service' });

app.use('/api/payments', require('../../routes/payments.routes'));

attachErrorHandler(app, 'payment-service');
startService(app, {
  serviceName: 'payment-service',
  portEnv: 'PAYMENT_SERVICE_PORT',
  defaultPort: 5006,
});
