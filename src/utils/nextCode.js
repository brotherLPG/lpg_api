function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function nextSequentialCode(Model, field, prefix, pad = 3, session) {
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
  if (session) {
    aggregate.session(session);
  }
  const [row] = await aggregate;

  const next = (row?.seq || 0) + 1;
  return `${prefixPart}${String(next).padStart(pad, '0')}`;
}

module.exports = { nextSequentialCode };
