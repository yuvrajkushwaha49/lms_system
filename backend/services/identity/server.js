const { loadEnv, connectDatabase, createServiceApp, attachErrorHandler, startService } = require('../../shared/bootstrap');

loadEnv();
connectDatabase();

const app = createServiceApp({ serviceName: 'identity-service' });

app.use('/api/auth', require('../../routes/auth.routes'));
app.use('/api/register', require('../../routes/register.routes'));

attachErrorHandler(app, 'identity-service');
startService(app, {
  serviceName: 'identity-service',
  portEnv: 'IDENTITY_SERVICE_PORT',
  defaultPort: 5001,
});
