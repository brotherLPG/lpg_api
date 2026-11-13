const { LPGReceipt, FillingBatch, StorageTank, SystemSetting } = require('../models');

const DEFAULT_SALE_PROFIT_PER_KG = 15;
const KG_EPSILON = 0.0001;

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function roundRate(value) {
  return Math.round((Number(value) + Number.EPSILON) * 10000) / 10000;
}

/**
 * Remaining-gas weighted average.
 * A receipt adds kg at its own rate. A filling removes kg and keeps the rate.
 * Cheap gas already filled out does not stay in the average.
 */
function replayGasCost(events) {
  const sorted = [...events].sort((a, b) => {
    const ta = new Date(a.at).getTime() || 0;
    const tb = new Date(b.at).getTime() || 0;
    if (ta !== tb) return ta - tb;
    if (a.kind !== b.kind) return a.kind === 'in' ? -1 : 1;
    const ca = new Date(a.createdAt).getTime() || 0;
    const cb = new Date(b.createdAt).getTime() || 0;
    return ca - cb;
  });

  let kg = 0;
  let value = 0;
  let lastAverage = 0;
  let lastEventAt = null;

  for (const event of sorted) {
    const qty = Number(event.kg) || 0;
    if (qty <= 0) continue;

    if (event.kind === 'in') {
      value += qty * (Number(event.rate) || 0);
      kg += qty;
      if (kg > KG_EPSILON) {
        lastAverage = value / kg;
        lastEventAt = event.at || null;
      }
    } else {
      const take = Math.min(qty, kg);
      if (take > 0 && kg > 0) {
        value -= (value / kg) * take;
        kg -= take;
        lastEventAt = event.at || lastEventAt;
        if (kg > KG_EPSILON) lastAverage = value / kg;
      }
    }

    if (kg <= KG_EPSILON) {
      kg = 0;
      value = 0;
    }
  }

  const hasStock = kg > KG_EPSILON;
  return {
    averageCostPerKg: roundRate(hasStock ? value / kg : lastAverage),
    stockKg: hasStock ? roundMoney(kg) : 0,
    stockValueAmount: hasStock ? roundMoney(value) : 0,
    lastEventAt: lastEventAt || null,
  };
}

function eventsFromHistory(receipts, batches) {
  const events = [];
  for (const receipt of receipts) {
    if ((receipt.receiptStatus || 'confirmed') === 'pending') continue;
    const kg = Number(receipt.receivedQuantityKg) || 0;
    if (kg <= 0) continue;
    events.push({
      at: receipt.receivedAt,
      createdAt: receipt.createdAt,
      kind: 'in',
      kg,
      rate: Number(receipt.purchaseRatePerKg) || 0,
    });
  }
  for (const batch of batches) {
    if ((batch.batchStatus || 'completed') === 'pending') continue;
    const kg = Number(batch.actualLpgUsedKg) || 0;
    if (kg <= 0) continue;
    events.push({
      at: batch.fillingDate,
      createdAt: batch.createdAt,
      kind: 'out',
      kg,
    });
  }
  return events;
}

async function recomputeTankCost(tankId, session) {
  const receiptQuery = LPGReceipt.find({
    storageTankId: tankId,
    receiptStatus: { $ne: 'pending' },
  }).select('receivedAt createdAt receivedQuantityKg purchaseRatePerKg receiptStatus');
  const batchQuery = FillingBatch.find({
    storageTankId: tankId,
    batchStatus: { $ne: 'pending' },
  }).select('fillingDate createdAt actualLpgUsedKg batchStatus');

  if (session) {
    receiptQuery.session(session);
    batchQuery.session(session);
  }

  const [receipts, batches] = await Promise.all([receiptQuery.lean(), batchQuery.lean()]);
  const cost = replayGasCost(eventsFromHistory(receipts, batches));
  const update = StorageTank.findByIdAndUpdate(
    tankId,
    {
      $set: {
        averageCostPerKg: cost.averageCostPerKg,
        costStockKg: cost.stockKg,
        costComputedAt: new Date(),
        lastCostEventAt: cost.lastEventAt,
      },
    },
    { new: true }
  );
  if (session) update.session(session);
  await update;
  return cost;
}

async function recomputeTankCosts(tankIds, session) {
  const ids = [...new Set((tankIds || []).filter(Boolean).map((id) => String(id)))];
  for (const id of ids) {
    await recomputeTankCost(id, session);
  }
}

async function readProfitPerKg() {
  const setting = await SystemSetting.findOne({ settingKey: 'saleProfitPerKg' })
    .select('settingValue')
    .lean();
  const parsed = Number(setting?.settingValue);
  if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  return DEFAULT_SALE_PROFIT_PER_KG;
}

async function refreshTankCosts() {
  const tanks = await StorageTank.find().select('_id').lean();
  await recomputeTankCosts(tanks.map((tank) => tank._id));
}

async function getSaleGasRate() {
  await refreshTankCosts();
  const [tanks, profitPerKg, receiptCount] = await Promise.all([
    StorageTank.find().select('averageCostPerKg costStockKg lastCostEventAt').lean(),
    readProfitPerKg(),
    LPGReceipt.countDocuments({
      receiptStatus: { $ne: 'pending' },
      purchaseRatePerKg: { $gt: 0 },
      receivedQuantityKg: { $gt: 0 },
    }),
  ]);

  if (!receiptCount) {
    return {
      averageCostPerKg: 0,
      profitPerKg,
      profitableRatePerKg: roundRate(profitPerKg),
      stockKg: 0,
    };
  }

  let stockKg = 0;
  let stockValue = 0;
  let fallbackRate = 0;
  let fallbackAt = 0;

  for (const tank of tanks) {
    const rate = Number(tank.averageCostPerKg) || 0;
    const kg = Number(tank.costStockKg) || 0;
    if (kg > 0 && rate > 0) {
      stockKg += kg;
      stockValue += kg * rate;
    }
    const at = new Date(tank.lastCostEventAt || 0).getTime();
    if (rate > 0 && at >= fallbackAt) {
      fallbackAt = at;
      fallbackRate = rate;
    }
  }

  const averageCostPerKg = stockKg > 0 ? roundRate(stockValue / stockKg) : roundRate(fallbackRate);
  return {
    averageCostPerKg,
    profitPerKg,
    profitableRatePerKg: roundRate(averageCostPerKg + profitPerKg),
    stockKg: roundMoney(stockKg),
  };
}

module.exports = {
  DEFAULT_SALE_PROFIT_PER_KG,
  replayGasCost,
  recomputeTankCost,
  recomputeTankCosts,
  getSaleGasRate,
};
