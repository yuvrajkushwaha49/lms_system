/**
 * API Gateway route map — all services share one MySQL database (DB_NAME).
 * Frontend keeps calling http://localhost:5000/api/*
 */
const services = {
  identity: {
    port: process.env.IDENTITY_SERVICE_PORT || 5001,
    host: process.env.IDENTITY_SERVICE_HOST || '127.0.0.1',
  },
  user: {
    port: process.env.USER_SERVICE_PORT || 5002,
    host: process.env.USER_SERVICE_HOST || '127.0.0.1',
  },
  course: {
    port: process.env.COURSE_SERVICE_PORT || 5003,
    host: process.env.COURSE_SERVICE_HOST || '127.0.0.1',
  },
  community: {
    port: process.env.COMMUNITY_SERVICE_PORT || 5004,
    host: process.env.COMMUNITY_SERVICE_HOST || '127.0.0.1',
  },
  content: {
    port: process.env.CONTENT_SERVICE_PORT || 5005,
    host: process.env.CONTENT_SERVICE_HOST || '127.0.0.1',
  },
  payment: {
    port: process.env.PAYMENT_SERVICE_PORT || 5006,
    host: process.env.PAYMENT_SERVICE_HOST || '127.0.0.1',
  },
};

function target(serviceKey) {
  const s = services[serviceKey];
  return `http://${s.host}:${s.port}`;
}

const gatewayRoutes = [
  { path: '/api/auth', service: 'identity' },
  { path: '/api/register', service: 'identity' },
  { path: '/api/users', service: 'user' },
  { path: '/api/org', service: 'user' },
  { path: '/api/courses', service: 'course' },
  { path: '/api/monthly-challenge-months', service: 'course' },
  { path: '/api/feed', service: 'community' },
  { path: '/api/messages', service: 'community' },
  { path: '/api/wall-of-wins', service: 'community' },
  { path: '/api/document-center', service: 'content' },
  { path: '/api/gallery', service: 'content' },
  { path: '/api/faqs', service: 'content' },
  { path: '/api/snacks', service: 'content' },
  { path: '/api/ask-ryan', service: 'content' },
  { path: '/api/welcome-video', service: 'content' },
  { path: '/api/start-here-steps', service: 'content' },
  { path: '/api/payments', service: 'payment' },
].map((route) => ({
  ...route,
  target: target(route.service),
}));

module.exports = {
  services,
  gatewayRoutes,
  gatewayPort: process.env.GATEWAY_PORT || 5000,
};
