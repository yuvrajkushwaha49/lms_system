const db = require('../config/db');
const createOrder = async (req, res) => {
  try {
    res.json({ status: 'success', message: 'Order created' });
  } catch(e) { res.status(500).json({status: 'error'}); }
};
module.exports = { createOrder };
