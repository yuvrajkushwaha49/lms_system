const { loadEnv, connectDatabase, createServiceApp, attachErrorHandler, startService } = require('../../shared/bootstrap');

loadEnv();
connectDatabase();

const app = createServiceApp({ serviceName: 'content-service' });

app.use('/api/document-center', require('../../routes/documentCenter.routes'));
app.use('/api/gallery', require('../../routes/gallery.routes'));
app.use('/api/faqs', require('../../routes/faqs.routes'));
app.use('/api/snacks', require('../../routes/snacks.routes'));
app.use('/api/ask-ryan', require('../../routes/askRyan.routes'));
app.use('/api/welcome-video', require('../../routes/welcomeVideo.routes'));
app.use('/api/start-here-steps', require('../../routes/startHereSteps.routes'));

attachErrorHandler(app, 'content-service');
startService(app, {
  serviceName: 'content-service',
  portEnv: 'CONTENT_SERVICE_PORT',
  defaultPort: 5005,
});
