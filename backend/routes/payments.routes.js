const express = require('express');
const router = express.Router();
const paymentsController = require('../controllers/payments.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

router.use(verifyToken);
router.post('/create-order', paymentsController.createOrder);

module.exports = router;
