const Sale = require('../models/sale.model');
const Payment = require('../models/payment.model');
const InventoryItem = require('../models/inventoryItem.model');

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const BUSINESS_TIMEZONE = 'Asia/Karachi';

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function roundPercent(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

function formatRs(value) {
  return `Rs. ${roundMoney(value).toLocaleString('en-US')}`;
}

function startOfDay(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dayKey(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateLabel(date) {
  const d = new Date(date);
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

function formatAsOfDateLabel(date = new Date()) {
  const d = new Date(date);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

function activeSaleMatch() {
  return { saleStatus: { $nin: ['cancelled', 'draft'] } };
}

function recordedReceiveMatch() {
  return {
    paymentType: 'receive',
    paymentStatus: { $ne: 'pending' },
  };
}

function periodRange(days, endExclusive = startOfDay(addDays(new Date(), 1))) {
  const end = startOfDay(endExclusive);
  const start = addDays(end, -Number(days));
  return { start, end };
}

function buildDayBuckets(days, endExclusive = startOfDay(addDays(new Date(), 1))) {
  const end = startOfDay(endExclusive);
  const buckets = [];
  for (let i = days; i >= 1; i -= 1) {
    const dayStart = addDays(end, -i);
    buckets.push({
      date: dayKey(dayStart),
      dateLabel: formatDateLabel(dayStart),
      start: dayStart,
      end: addDays(dayStart, 1),
    });
  }
  return buckets;
}

async function sumSalesAmount(start, end) {
  const rows = await Sale.aggregate([
    {
      $match: {
        ...activeSaleMatch(),
        invoiceDate: { $gte: start, $lt: end },
      },
    },
    { $group: { _id: null, amount: { $sum: '$totalAmount' } } },
  ]);
  return roundMoney(rows[0]?.amount);
}

async function sumReceivedAmount(start, end) {
  const rows = await Payment.aggregate([
    {
      $match: {
        ...recordedReceiveMatch(),
        paymentDate: { $gte: start, $lt: end },
      },
    },
    { $group: { _id: null, amount: { $sum: '$paymentAmount' } } },
  ]);
  return roundMoney(rows[0]?.amount);
}

async function dailySalesMap(start, end) {
  const rows = await Sale.aggregate([
    {
      $match: {
        ...activeSaleMatch(),
        invoiceDate: { $gte: start, $lt: end },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: '$invoiceDate',
            timezone: BUSINESS_TIMEZONE,
          },
        },
        amount: { $sum: '$totalAmount' },
      },
    },
  ]);
  return new Map(rows.map((row) => [row._id, roundMoney(row.amount)]));
}

async function dailyReceivedMap(start, end) {
  const rows = await Payment.aggregate([
    {
      $match: {
        ...recordedReceiveMatch(),
        paymentDate: { $gte: start, $lt: end },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: '$paymentDate',
            timezone: BUSINESS_TIMEZONE,
          },
        },
        amount: { $sum: '$paymentAmount' },
      },
    },
  ]);
  return new Map(rows.map((row) => [row._id, roundMoney(row.amount)]));
}

function changeMetric(currentAmount, previousAmount, days) {
  const current = roundMoney(currentAmount);
  const previous = roundMoney(previousAmount);
  let changePercent = 0;
  if (previous === 0) {
    changePercent = current > 0 ? 100 : 0;
  } else {
    changePercent = roundPercent(((current - previous) / previous) * 100);
  }

  const sign = changePercent > 0 ? '+' : '';
  const trend = changePercent > 0 ? 'up' : changePercent < 0 ? 'down' : 'flat';

  return {
    amount: current,
    formattedAmount: formatRs(current),
    previousAmount: previous,
    previousFormattedAmount: formatRs(previous),
    changePercent,
    changeLabel: `${sign}${changePercent}% vs. previous ${days} days`,
    trend,
  };
}

function alertSeverity(currentQuantity, minimumStockLevel, stockStatus) {
  const qty = Number(currentQuantity) || 0;
  const min = Number(minimumStockLevel) || 0;
  const ratio = min > 0 ? qty / min : 0;

  if (stockStatus === 'out-of-stock' || qty <= 0) {
    return { alertSeverity: 'critical', statusColor: 'red' };
  }
  if (qty <= 5 || ratio <= 0.25) {
    return { alertSeverity: 'critical', statusColor: 'red' };
  }
  return { alertSeverity: 'warning', statusColor: 'orange' };
}

function stockStatusOf(item) {
  const qty = Number(item.currentQuantity) || 0;
  const min = Number(item.minimumStockLevel) || 0;
  if (qty <= 0) {
    return { stockStatus: 'out-of-stock', stockStatusLabel: 'Out of Stock' };
  }
  if (min > 0 && qty <= min) {
    return { stockStatus: 'low-stock', stockStatusLabel: 'Low Stock' };
  }
  return { stockStatus: 'in-stock', stockStatusLabel: 'In Stock' };
}

async function buildKpis(days) {
  const current = periodRange(days);
  const previous = periodRange(days, current.start);

  const [salesCurrent, salesPrevious, receivedCurrent, receivedPrevious] = await Promise.all([
    sumSalesAmount(current.start, current.end),
    sumSalesAmount(previous.start, previous.end),
    sumReceivedAmount(current.start, current.end),
    sumReceivedAmount(previous.start, previous.end),
  ]);

  const outstandingAmount = roundMoney(Math.max(0, salesCurrent - receivedCurrent));
  const sales = changeMetric(salesCurrent, salesPrevious, days);
  const received = changeMetric(receivedCurrent, receivedPrevious, days);

  return {
    periodDays: days,
    periodStart: dayKey(current.start),
    periodEnd: dayKey(addDays(current.end, -1)),
    totalSales: {
      label: 'Total Sales',
      ...sales,
    },
    totalReceivedPayment: {
      label: 'Total Received Payment',
      ...received,
    },
    outstandingReceivable: {
      label: 'Outstanding Receivable',
      amount: outstandingAmount,
      formattedAmount: formatRs(outstandingAmount),
      description: 'Sales minus received',
    },
  };
}

async function buildSalesPaymentTrend(days) {
  const buckets = buildDayBuckets(days);
  const rangeStart = buckets[0].start;
  const rangeEnd = buckets[buckets.length - 1].end;

  const [salesMap, receivedMap] = await Promise.all([
    dailySalesMap(rangeStart, rangeEnd),
    dailyReceivedMap(rangeStart, rangeEnd),
  ]);

  const series = buckets.map((bucket) => {
    const salesAmount = roundMoney(salesMap.get(bucket.date) || 0);
    const receivedAmount = roundMoney(receivedMap.get(bucket.date) || 0);
    return {
      date: bucket.date,
      dateLabel: bucket.dateLabel,
      salesAmount,
      salesFormattedAmount: formatRs(salesAmount),
      receivedAmount,
      receivedFormattedAmount: formatRs(receivedAmount),
      differenceAmount: roundMoney(salesAmount - receivedAmount),
    };
  });

  let highestSales = series[0];
  let highestReceived = series[0];
  for (const point of series) {
    if (point.salesAmount > highestSales.salesAmount) highestSales = point;
    if (point.receivedAmount > highestReceived.receivedAmount) highestReceived = point;
  }

  const averageDifferenceAmount = series.length
    ? roundMoney(series.reduce((sum, point) => sum + point.differenceAmount, 0) / series.length)
    : 0;

  return {
    title: 'Sales & Receiving Payment Trend',
    periodLabel: `Last ${days} days`,
    periodDays: days,
    legend: [
      { key: 'sales', label: 'Sales', color: 'blue' },
      { key: 'receivedPayment', label: 'Received Payment', color: 'green' },
    ],
    series,
    highlights: {
      highestSales: {
        label: 'Highest Sales',
        amount: highestSales.salesAmount,
        formattedAmount: formatRs(highestSales.salesAmount),
        date: highestSales.date,
        dateLabel: highestSales.dateLabel,
      },
      highestReceivedPayment: {
        label: 'Highest Received Payment',
        amount: highestReceived.receivedAmount,
        formattedAmount: formatRs(highestReceived.receivedAmount),
        date: highestReceived.date,
        dateLabel: highestReceived.dateLabel,
      },
      averageDifference: {
        label: 'Average Difference',
        amount: averageDifferenceAmount,
        formattedAmount: formatRs(averageDifferenceAmount),
        description: 'per day',
      },
    },
  };
}

async function buildLowStockAlerts(limit = 10) {
  const items = await InventoryItem.find({
    isActive: true,
    $expr: {
      $or: [
        { $lte: ['$currentQuantity', 0] },
        {
          $and: [
            { $gt: ['$minimumStockLevel', 0] },
            { $lte: ['$currentQuantity', '$minimumStockLevel'] },
          ],
        },
      ],
    },
  })
    .select('itemCode itemName itemCategory currentQuantity minimumStockLevel unitOfMeasure')
    .sort({ currentQuantity: 1, itemName: 1 })
    .limit(Math.max(1, Number(limit) || 10))
    .lean();

  const alerts = items.map((item) => {
    const status = stockStatusOf(item);
    const severity = alertSeverity(item.currentQuantity, item.minimumStockLevel, status.stockStatus);
    const currentQuantity = Number(item.currentQuantity) || 0;
    const minimumStockLevel = Number(item.minimumStockLevel) || 0;
    const stockRatio = minimumStockLevel > 0
      ? Math.min(1, roundMoney(currentQuantity / minimumStockLevel))
      : 0;

    return {
      itemId: item._id,
      itemCode: item.itemCode,
      itemName: item.itemName,
      itemCategory: item.itemCategory,
      unitOfMeasure: item.unitOfMeasure,
      currentQuantity,
      minimumStockLevel,
      stockRatio,
      progressPercent: roundMoney(stockRatio * 100),
      remainingLabel: `${currentQuantity} remaining · Min ${minimumStockLevel}`,
      ...status,
      ...severity,
    };
  });

  alerts.sort((left, right) => {
    const severityRank = { critical: 0, warning: 1 };
    const bySeverity = (severityRank[left.alertSeverity] ?? 2) - (severityRank[right.alertSeverity] ?? 2);
    if (bySeverity !== 0) return bySeverity;
    return left.stockRatio - right.stockRatio;
  });

  return {
    title: 'Low-Stock Alerts',
    alertCount: alerts.length,
    viewInventoryPath: '/inventory-items',
    items: alerts,
  };
}

async function buildRecentSales(limit = 5) {
  const items = await Sale.find(activeSaleMatch())
    .populate('customerId', 'customerCode customerName')
    .select('invoiceNumber invoiceDate totalAmount customerId saleStatus paymentStatus')
    .sort({ invoiceDate: -1, createdAt: -1 })
    .limit(Math.max(1, Number(limit) || 5))
    .lean();

  return {
    title: 'Recent Sales',
    subtitle: 'Latest invoices from distributors',
    viewAllPath: '/sales',
    columns: [
      { key: 'invoiceNumber', label: 'Invoice #' },
      { key: 'customerName', label: 'Customer' },
    ],
    items: items.map((sale) => {
      const customer = sale.customerId && typeof sale.customerId === 'object' ? sale.customerId : null;
      return {
        saleId: sale._id,
        invoiceNumber: sale.invoiceNumber,
        customerId: customer?._id || sale.customerId || null,
        customerName: customer?.customerName || '',
        customerCode: customer?.customerCode || '',
        invoiceDate: sale.invoiceDate || null,
        totalAmount: roundMoney(sale.totalAmount),
        formattedTotalAmount: formatRs(sale.totalAmount),
        saleStatus: sale.saleStatus,
        paymentStatus: sale.paymentStatus,
      };
    }),
  };
}

async function buildRecentPayments(limit = 5) {
  const items = await Payment.find({ paymentStatus: { $ne: 'pending' } })
    .populate('customerId', 'customerCode customerName')
    .populate('supplierId', 'supplierCode supplierName')
    .populate('accountId', 'accountCode accountName')
    .select('paymentNumber paymentDate paymentAmount paymentType customerId supplierId accountId paymentStatus')
    .sort({ paymentDate: -1, createdAt: -1 })
    .limit(Math.max(1, Number(limit) || 5))
    .lean();

  return {
    title: 'Recent Payments',
    subtitle: 'Latest collections and supplier payments',
    viewAllPath: '/payments',
    columns: [
      { key: 'receiptNumber', label: 'Receipt #' },
      { key: 'payeeAccountName', label: 'Payee / Account' },
    ],
    items: items.map((payment) => {
      const customer = payment.customerId && typeof payment.customerId === 'object' ? payment.customerId : null;
      const supplier = payment.supplierId && typeof payment.supplierId === 'object' ? payment.supplierId : null;
      const account = payment.accountId && typeof payment.accountId === 'object' ? payment.accountId : null;
      const partyName = customer?.customerName || supplier?.supplierName || '';
      const accountName = account?.accountName || '';
      const payeeAccountName = partyName || accountName || '';

      return {
        paymentId: payment._id,
        receiptNumber: payment.paymentNumber,
        paymentNumber: payment.paymentNumber,
        payeeAccountName,
        partyName,
        partyType: supplier ? 'supplier' : customer ? 'customer' : null,
        customerId: customer?._id || payment.customerId || null,
        supplierId: supplier?._id || payment.supplierId || null,
        accountId: account?._id || payment.accountId || null,
        accountName,
        paymentType: payment.paymentType,
        paymentDate: payment.paymentDate || null,
        paymentAmount: roundMoney(payment.paymentAmount),
        formattedPaymentAmount: formatRs(payment.paymentAmount),
        paymentStatus: payment.paymentStatus,
      };
    }),
  };
}

async function getOperationsOverview(query = {}) {
  const days = Math.min(90, Math.max(1, Number(query.days) || 7));
  const alertLimit = Math.min(50, Math.max(1, Number(query.alertLimit) || 10));
  const recentLimit = Math.min(20, Math.max(1, Number(query.recentLimit) || 5));
  const now = new Date();

  const [kpis, salesPaymentTrend, lowStockAlerts, recentSales, recentPayments] = await Promise.all([
    buildKpis(days),
    buildSalesPaymentTrend(days),
    buildLowStockAlerts(alertLimit),
    buildRecentSales(recentLimit),
    buildRecentPayments(recentLimit),
  ]);

  return {
    title: 'Operations Overview',
    subtitle: 'Monitor live sales, collections, filling activity, and inventory alerts for the plant in one place.',
    asOfDate: dayKey(now),
    asOfDateLabel: formatAsOfDateLabel(now),
    currency: 'PKR',
    currencyPrefix: 'Rs.',
    kpis,
    salesPaymentTrend,
    lowStockAlerts,
    recentSales,
    recentPayments,
  };
}

async function getInventoryAlerts(query = {}) {
  const alertLimit = Math.min(50, Math.max(1, Number(query.limit) || Number(query.alertLimit) || 10));
  return buildLowStockAlerts(alertLimit);
}

module.exports = {
  getOperationsOverview,
  getInventoryAlerts,
};
