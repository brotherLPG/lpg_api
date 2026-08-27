const mongoose = require('mongoose');

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

module.exports = { isObjectId };
