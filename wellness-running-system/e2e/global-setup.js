const { resetDb } = require('./db/seed');

module.exports = async () => {
  await resetDb();
};
