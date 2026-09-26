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

async function raiseCounterTo(key, seq, session) {
  const write = async (upsert) => {
    const options = { upsert };
    if (session) options.session = session;
    await Counter.updateOne({ _id: key }, { $max: { seq } }, options);
  };
  try {
    await write(true);
  } catch (error) {
    if (error?.code !== 11000) throw error;
    await write(false);
  }
}

async function seedCounter(key, max, session) {
  await raiseCounterTo(key, max, session);
}

async function codeTaken(Model, field, code, session) {
  const query = Model.exists({ [field]: code });
  if (session) query.session(session);
  return Boolean(await query);
}

function parsedSequence(code) {
  const match = String(code || '').match(/^(.*)-(\d+)$/);
  if (!match) return null;
  return { prefix: match[1], seq: Number(match[2]) };
}

async function claimSequentialCode(Model, field, code, session) {
  const parsed = parsedSequence(code);
  if (!parsed) return;
  await ensureCountersCollection();
  await raiseCounterTo(counterKey(Model, field, parsed.prefix), parsed.seq, session);
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

  for (let attempt = 0; attempt < 3; attempt += 1) {
    let updated = await Counter.findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, options);
    if (!updated) {
      const max = await currentMaxSeq(Model, field, prefix, session);
      await raiseCounterTo(key, max, session);
      updated = await Counter.findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, options);
    }
    if (!updated) break;
    const code = formatCode(prefix, updated.seq, pad);
    if (!(await codeTaken(Model, field, code, session))) return code;
    const max = await currentMaxSeq(Model, field, prefix, session);
    await raiseCounterTo(key, max, session);
  }

  throw new Error(`Failed to allocate next ${prefix} code`);
}

async function peekSequentialCode(Model, field, prefix, pad = 3) {
  const { key, seq } = await storedSeq(Model, field, prefix);
  const candidate = formatCode(prefix, seq + 1, pad);
  if (!(await codeTaken(Model, field, candidate))) return candidate;
  const max = await currentMaxSeq(Model, field, prefix);
  await raiseCounterTo(key, max);
  return formatCode(prefix, max + 1, pad);
}

async function useSequentialCode(Model, field, prefix, provided, pad = 3, session) {
  const current = String(provided || '').trim();
  if (current) {
    await claimSequentialCode(Model, field, current, session);
    if (!(await codeTaken(Model, field, current, session))) return current;
  }
  return nextSequentialCode(Model, field, prefix, pad, session);
}

module.exports = { nextSequentialCode, peekSequentialCode, claimSequentialCode, useSequentialCode };
