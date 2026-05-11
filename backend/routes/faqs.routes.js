const express = require('express');
const router = express.Router();
const faqsController = require('../controllers/faqs.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

router.use(verifyToken);

router.get('/', faqsController.getFaqs);
router.post('/', faqsController.createFaq);
router.patch('/:faqId', faqsController.updateFaq);
router.delete('/:faqId', faqsController.deleteFaq);

module.exports = router;

