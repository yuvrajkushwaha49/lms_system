const { loadEnv, connectDatabase, createServiceApp, attachErrorHandler, startService } = require('../../shared/bootstrap');

loadEnv();
connectDatabase();

const app = createServiceApp({ serviceName: 'user-service' });

app.use('/api/users', require('../../routes/users.routes'));
app.use('/api/org', require('../../routes/org.routes'));

attachErrorHandler(app, 'user-service');
startService(app, {
  serviceName: 'user-service',
  portEnv: 'USER_SERVICE_PORT',
  defaultPort: 5002,
});
