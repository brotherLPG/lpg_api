const { connectDB } = require('../src/config/db');
const app = require('../src/app');

module.exports = async (req, res) => {
  try {
    await connectDB();
  } catch (error) {
    if (!res.headersSent) {
      res.status(503).json({
        success: false,
        message: 'Database unavailable. Check MongoDB connection and Atlas network access.',
      });
    }
    return;
  }

  return app(req, res);
};
