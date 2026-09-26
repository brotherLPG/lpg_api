const mongoose = require('mongoose');
const Counter = require('../models/counter.model');

let countersReady = false;

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function counterKey(Model, field, prefix) {
  return `${Model.modelName}:${field}:${prefix}`;
}

function formatCode(prefix, seq, pad) {
  return `${prefix}-${String(seq).padStart(pad, '0')}`;
}

function applySession(query, session) {
  return session ? query.session(session) : query;
}

async function ensureCountersCollection() {
  if (countersReady) return;
  if (mongoose.connection.readyState !== 1) return;
  const existing = await mongoose.connection.db
    .listCollections({ name: 'counters' }, { nameOnly: true })
    .toArray();
  if (!existing.length) {
    await mongoose.connection.db.createCollection('counters');
  }
  countersReady = true;
}

async function currentMaxSeq(Model, field, prefix, session) {
  const prefixPart = `${prefix}-`;
  const pipeline = [
    { $match: { [field]: { $regex: `^${escapeRegex(prefixPart)}\\d+$` } } },
    {
      $project: {
        seq: {
          $convert: {
            input: { $substrBytes: [`$${field}`, prefixPart.length, 8] },
            to: 'int',
            onError: 0,
            onNull: 0,
          },
        },
      },
    },
    { $sort: { seq: -1 } },
    { $limit: 1 },
  ];
  const aggregate = Model.aggregate(pipeline);
  if (session) aggregate.session(session);
  const [row] = await aggregate;
  return row?.seq || 0;
}

async function readCounter(key, session) {
  return applySession(Counter.findById(key), session);
}

async function seedCounter(key, max, session) {
  const options = { upsert: true };
  if (session) options.session = session;
  await Counter.updateOne({ _id: key }, { $setOnInsert: { seq: max } }, options);
}

async function storedSeq(Model, field, prefix, session) {
  await ensureCountersCollection();
  const key = counterKey(Model, field, prefix);
  let counter = await readCounter(key, session);
  if (!counter) {
    const max = await currentMaxSeq(Model, field, prefix, session);
    await seedCounter(key, max, session);
    counter = await readCounter(key, session);
  }
  return { key, seq: counter?.seq || 0 };
}

async function nextSequentialCode(Model, field, prefix, pad = 3, session) {
  await ensureCountersCollection();
  const key = counterKey(Model, field, prefix);
  const options = { new: true };
  if (session) options.session = session;

  let updated = await Counter.findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, options);
  if (!updated) {
    const max = await currentMaxSeq(Model, field, prefix, session);
    await seedCounter(key, max, session);
    updated = await Counter.findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, options);
  }
  if (!updated) {
    throw new Error(`Failed to allocate next ${prefix} code`);
  }
  return formatCode(prefix, updated.seq, pad);
}

async function peekSequentialCode(Model, field, prefix, pad = 3) {
  const { seq } = await storedSeq(Model, field, prefix);
  return formatCode(prefix, seq + 1, pad);
}

module.exports = { nextSequentialCode, peekSequentialCode };
