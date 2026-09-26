const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema(
  {
    _id: { type: String },
    seq: { type: Number, required: true, default: 0 },
  },
  { versionKey: false, collection: 'counters' }
);

module.exports = mongoose.model('Counter', counterSchema);
