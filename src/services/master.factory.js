const cache = require('../config/cache');
const ApiError = require('../utils/ApiError');
const { parsePagination, paginated } = require('../utils/pagination');
const { nextSequentialCode } = require('../utils/nextCode');
const { writeAudit } = require('./audit.service');

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
  listMeta,
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

  async function assertUnique(value, excludeId) {
    if (!uniqueField || value === undefined || value === null) {
      return;
    }
    const filter = { [uniqueField]: value };
    if (excludeId) {
      filter._id = { $ne: excludeId };
    }
    const exists = await Model.findOne(filter).select('_id');
    if (exists) {
      throw new ApiError(409, `${uniqueField} already exists`);
    }
  }

  async function assignCode(payload) {
    if (!codePrefix || !uniqueField) return payload;
    const current = String(payload[uniqueField] || '').trim();
    if (current) {
      payload[uniqueField] = current;
      return payload;
    }
    payload[uniqueField] = await nextSequentialCode(Model, uniqueField, codePrefix);
    return payload;
  }

  async function create(body, req) {
    let payload = prepareCreate ? await prepareCreate({ ...body }, req) : { ...body };
    payload = await assignCode(payload);
    if (uniqueField) {
      await assertUnique(payload[uniqueField]);
    }
    let doc;
    try {
      doc = await Model.create(payload);
    } catch (error) {
      if (error?.code !== 11000 || !codePrefix) {
        throw error;
      }
      payload[uniqueField] = await nextSequentialCode(Model, uniqueField, codePrefix);
      await assertUnique(payload[uniqueField]);
      doc = await Model.create(payload);
    }
    invalidate(doc._id);
    await writeAudit({
      req,
      actionName: 'create',
      moduleName,
      entityName,
      entityId: doc._id,
      newValues: payload,
    });
    return getById(doc._id);
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

    const result = paginated(items, total, page, limit);
    if (listMeta) {
      result.meta = await listMeta(query);
    }
    return result;
  }

  async function getById(id) {
    let findQuery = Model.findById(id);
    findQuery = applyPopulate(findQuery);
    const doc = await findQuery;
    if (!doc) {
      throw new ApiError(404, `${entityName} not found`);
    }
    return doc;
  }

  async function update(id, body, req) {
    const doc = await Model.findById(id);
    if (!doc) {
      throw new ApiError(404, `${entityName} not found`);
    }

    const payload = prepareUpdate ? await prepareUpdate({ ...body }, doc, req) : { ...body };
    if (uniqueField && payload[uniqueField] !== undefined) {
      await assertUnique(payload[uniqueField], id);
    }

    const oldValues = uniqueField
      ? { [uniqueField]: doc[uniqueField] }
      : { _id: doc._id };

    Object.assign(doc, payload);
    await doc.save();
    invalidate(id);
    await writeAudit({
      req,
      actionName: 'update',
      moduleName,
      entityName,
      entityId: doc._id,
      oldValues,
      newValues: payload,
    });
    return getById(id);
  }

  async function remove(id, req) {
    if (!allowDelete) {
      throw new ApiError(405, `${entityName} cannot be deleted`);
    }
    const doc = await Model.findById(id);
    if (!doc) {
      throw new ApiError(404, `${entityName} not found`);
    }
    if (assertDelete) {
      await assertDelete(doc);
    }
    await doc.deleteOne();
    invalidate(id);
    await writeAudit({
      req,
      actionName: 'delete',
      moduleName,
      entityName,
      entityId: id,
      oldValues: uniqueField ? { [uniqueField]: doc[uniqueField] } : { _id: id },
    });
  }

  return { create, list, getById, update, remove };
}

module.exports = { createMasterService };
