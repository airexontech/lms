require('dotenv').config();

module.exports = {
  port: process.env.PORT || 5000,
  jwtSecret: process.env.JWT_SECRET || 'fallback_secret_key_change_in_production',
  nodeEnv: process.env.NODE_ENV || 'development'
};
