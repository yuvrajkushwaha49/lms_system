const { loadEnv, connectDatabase, createServiceApp, attachErrorHandler, startService } = require('../../shared/bootstrap');

loadEnv();
connectDatabase();

const app = createServiceApp({ serviceName: 'course-service' });

app.use('/api/courses', require('../../routes/courses.routes'));
app.use('/api/monthly-challenge-months', require('../../routes/monthlyChallengeMonths.routes'));

attachErrorHandler(app, 'course-service');
startService(app, {
  serviceName: 'course-service',
  portEnv: 'COURSE_SERVICE_PORT',
  defaultPort: 5003,
});
