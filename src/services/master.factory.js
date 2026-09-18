const mongoose = require('mongoose');
const cache = require('../config/cache');
const ApiError = require('../utils/ApiError');
const { parsePagination, paginated } = require('../utils/pagination');
const { nextSequentialCode } = require('../utils/nextCode');
const { writeAudit } = require('./audit.service');

async function withTransaction(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

function createMasterService({
  Model,
  entityName,
  moduleName,
  uniqueField,
  cachePrefix,
  codePrefix,
  populate = [],
  searchFields = [],
  sort = { createdAt: -1 },
  allowDelete = true,
  extraFilters,
  prepareCreate,
  prepareUpdate,
  assertDelete,
  afterCreate,
  afterUpdate,
  beforeDelete,
  useTransaction = false,
  listMeta,
  listSummary,
  mapItem,
  formOptions,
  hasIsActive = true,
}) {
  function applyPopulate(query) {
    populate.forEach((item) => {
      if (typeof item === 'string') {
        query = query.populate(item);
      } else {
        query = query.populate(item);
      }
    });
    return query;
  }

  function invalidate(id) {
    cache.delByPrefix(cachePrefix);
    if (id) {
      cache.del(`${cachePrefix}${id}`);
    }
  }

  async function assertUnique(value, excludeId, session) {
    if (!uniqueField || value === undefined || value === null) {
      return;
    }
    const filter = { [uniqueField]: value };
    if (excludeId) {
      filter._id = { $ne: excludeId };
    }
    let query = Model.findOne(filter).select('_id');
    if (session) query = query.session(session);
    const exists = await query;
    if (exists) {
      throw new ApiError(409, `${uniqueField} already exists`);
    }
  }

  async function assignCode(payload, session) {
    if (!codePrefix || !uniqueField) return payload;
    const current = String(payload[uniqueField] || '').trim();
    if (current) {
      payload[uniqueField] = current;
      return payload;
    }
    payload[uniqueField] = await nextSequentialCode(Model, uniqueField, codePrefix, 3, session);
    return payload;
  }

  async function createDocument(payload, session) {
    if (session) {
      const [doc] = await Model.create([payload], { session });
      return doc;
    }
    return Model.create(payload);
  }

  async function create(body, req) {
    const run = async (session) => {
      let payload = prepareCreate ? await prepareCreate({ ...body }, req, session) : { ...body };
      payload = await assignCode(payload, session);
      if (uniqueField) {
        await assertUnique(payload[uniqueField], null, session);
      }

      let doc;
      try {
        doc = await createDocument(payload, session);
      } catch (error) {
        if (error?.code !== 11000 || !codePrefix) {
          throw error;
        }
        payload[uniqueField] = await nextSequentialCode(Model, uniqueField, codePrefix, 3, session);
        await assertUnique(payload[uniqueField], null, session);
        doc = await createDocument(payload, session);
      }

      if (afterCreate) {
        await afterCreate(doc, payload, req, session);
      }

      await writeAudit({
        req,
        session,
        actionName: 'create',
        moduleName,
        entityName,
        entityId: doc._id,
        newValues: payload,
      });
      return doc._id;
    };

    const id = useTransaction ? await withTransaction(run) : await run(null);
    invalidate(id);
    return toResponse(await loadById(id));
  }

  function toResponse(doc) {
    if (!mapItem || !doc) return doc;
    const plain = typeof doc.toObject === 'function' ? doc.toObject() : doc;
    return mapItem(plain);
  }

  async function list(query) {
    const { page, limit, skip } = parsePagination(query);
    const filter = extraFilters ? extraFilters(query) : {};

    if (hasIsActive) {
      if (query.isActive === 'true') filter.isActive = true;
      if (query.isActive === 'false') filter.isActive = false;
    }

    if (query.search && searchFields.length) {
      filter.$or = searchFields.map((field) => ({
        [field]: { $regex: query.search, $options: 'i' },
      }));
    }

    let findQuery = Model.find(filter).sort(sort).skip(skip).limit(limit);
    findQuery = applyPopulate(findQuery);

    const [items, total] = await Promise.all([
      findQuery.lean(),
      Model.countDocuments(filter),
    ]);

    const mapped = mapItem ? items.map(mapItem) : items;
    const result = paginated(mapped, total, page, limit);
    if (listMeta) {
      result.meta = await listMeta(query);
    }
    if (listSummary) {
      result.summary = await listSummary(query);
    }
    return result;
  }

  async function loadById(id) {
    let findQuery = Model.findById(id);
    findQuery = applyPopulate(findQuery);
    const doc = await findQuery;
    if (!doc) {
      throw new ApiError(404, `${entityName} not found`);
    }
    return doc;
  }

  async function getFormOptions(query = {}) {
    if (!formOptions) {
      throw new ApiError(404, 'Form options are not available');
    }
    return formOptions(query);
  }

  async function getById(id) {
    const doc = await loadById(id);
    const mapped = toResponse(doc);
    if (!formOptions) {
      return mapped;
    }
    return {
      ...mapped,
      form: await formOptions({ id }),
    };
  }

  async function update(id, body, req) {
    const run = async (session) => {
      let findQuery = Model.findById(id);
      if (session) findQuery = findQuery.session(session);
      const doc = await findQuery;
      if (!doc) {
        throw new ApiError(404, `${entityName} not found`);
      }

      const previous = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
      const payload = prepareUpdate
        ? await prepareUpdate({ ...body }, doc, req, session)
        : { ...body };
      if (uniqueField && payload[uniqueField] !== undefined) {
        await assertUnique(payload[uniqueField], id, session);
      }

      const oldValues = uniqueField
        ? { [uniqueField]: doc[uniqueField] }
        : { _id: doc._id };

      Object.assign(doc, payload);
      await doc.save(session ? { session } : undefined);

      if (afterUpdate) {
        await afterUpdate(doc, payload, previous, req, session);
      }

      await writeAudit({
        req,
        session,
        actionName: 'update',
        moduleName,
        entityName,
        entityId: doc._id,
        oldValues,
        newValues: payload,
      });
      return doc._id;
    };

    const docId = useTransaction ? await withTransaction(run) : await run(null);
    invalidate(docId);
    return toResponse(await loadById(docId));
  }

  async function remove(id, req) {
    if (!allowDelete) {
      throw new ApiError(405, `${entityName} cannot be deleted`);
    }

    const run = async (session) => {
      let findQuery = Model.findById(id);
      if (session) findQuery = findQuery.session(session);
      const doc = await findQuery;
      if (!doc) {
        throw new ApiError(404, `${entityName} not found`);
      }
      if (assertDelete) {
        await assertDelete(doc, session);
      }
      if (beforeDelete) {
        await beforeDelete(doc, req, session);
      }
      await doc.deleteOne(session ? { session } : undefined);
      await writeAudit({
        req,
        session,
        actionName: 'delete',
        moduleName,
        entityName,
        entityId: id,
        oldValues: uniqueField ? { [uniqueField]: doc[uniqueField] } : { _id: id },
      });
    };

    if (useTransaction) {
      await withTransaction(run);
    } else {
      await run(null);
    }
    invalidate(id);
  }

  return {
    create,
    list,
    getById,
    update,
    remove,
    ...(formOptions ? { getFormOptions } : {}),
  };
}

module.exports = { createMasterService };
