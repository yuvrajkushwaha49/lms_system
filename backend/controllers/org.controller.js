const db = require('../config/db');

const getOrgDashboardStats = async (req, res) => {
  try {
    const org_id = req.user.org_id;
    const [students] = await db.query(`SELECT COUNT(*) as total FROM users WHERE business_id = ? AND role_id = (SELECT id FROM roles WHERE name = 'Student')`, [org_id]);
    const [courses] = await db.query(`SELECT COUNT(*) as total FROM courses WHERE org_id = ?`, [org_id]);
    const [instructors] = await db.query(`SELECT COUNT(*) as total FROM users WHERE business_id = ? AND role_id = (SELECT id FROM roles WHERE name = 'Instructor')`, [org_id]);
    const [revenue] = await db.query(`SELECT SUM(amount) as total_revenue FROM payments WHERE org_id = ? AND status = 'successful'`, [org_id]);

    res.json({
      status: 'success',
      data: {
        total_students: students[0].total,
        total_courses: courses[0].total,
        total_instructors: instructors[0].total,
        total_revenue: revenue[0].total_revenue || 0
      }
    });

  } catch (error) {
    res.status(500).json({ status: 'error' });
  }
};
module.exports = { getOrgDashboardStats };
