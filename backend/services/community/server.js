const { loadEnv, connectDatabase, createServiceApp, attachErrorHandler, startService } = require('../../shared/bootstrap');

loadEnv();
connectDatabase();

const app = createServiceApp({ serviceName: 'community-service' });

app.use('/api/feed', require('../../routes/feed.routes'));
app.use('/api/messages', require('../../routes/messages.routes'));
app.use('/api/wall-of-wins', require('../../routes/wallOfWins.routes'));
app.use('/api/upcoming-events', require('../../routes/upcomingEvents.routes'));

attachErrorHandler(app, 'community-service');
startService(app, {
  serviceName: 'community-service',
  portEnv: 'COMMUNITY_SERVICE_PORT',
  defaultPort: 5004,
});
