import mongoose from 'mongoose';
import Order from '../models/order.model.js';

type OrderModel = typeof Order;

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Canonical DB enums (uppercase). */
export const ORDER_STATUSES = [
  'PENDING',
  'ACCEPTED',
  'IN_PROGRESS',
  'QUALITY_CHECK',
  'COMPLETED',
  'RECEIVED',
  'ON_HOLD',
  'REVISION_REQUESTED',
] as const;

const TERMINAL: string[] = ['COMPLETED', 'RECEIVED'];
const RECEIVED_ONLY: string[] = ['RECEIVED'];
const PENDING_LIKE: string[] = ['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'QUALITY_CHECK'];

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  IN_PROGRESS: 'In Progress',
  QUALITY_CHECK: 'Quality Check',
  COMPLETED: 'Completed',
  RECEIVED: 'Received',
  ON_HOLD: 'On Hold',
  REVISION_REQUESTED: 'Revision Requested',
};

/** $addFields: _status normalized uppercase + aligned to known enums when possible. */
export function statusNormalizeStage(): mongoose.PipelineStage {
  const known = ORDER_STATUSES as unknown as string[];
  return {
    $addFields: {
      _status: {
        $let: {
          vars: { u: { $toUpper: { $trim: { input: { $ifNull: ['$status', ''] } } } } },
          in: {
            $cond: [
              { $in: ['$$u', known] },
              '$$u',
              {
                $switch: {
                  branches: [
                    { case: { $eq: ['$$u', ''] }, then: 'PENDING' },
                    { case: { $eq: ['$$u', 'INPROGRESS'] }, then: 'IN_PROGRESS' },
                    { case: { $eq: ['$$u', 'QUALITYCHECK'] }, then: 'QUALITY_CHECK' },
                    { case: { $eq: ['$$u', 'REVISIONREQUESTED'] }, then: 'REVISION_REQUESTED' },
                  ],
                  default: '$$u',
                },
              },
            ],
          },
        },
      },
    },
  };
}

export type AnalyticsDateRange = { from?: Date; to?: Date } | null;

export function parseAnalyticsRange(query: Record<string, unknown>): {
  range: AnalyticsDateRange;
  error?: string;
} {
  const fromRaw = query.from;
  const toRaw = query.to;
  const rangeRaw = query.range;

  const hasCustom =
    (fromRaw != null && fromRaw !== '') || (toRaw != null && toRaw !== '');

  if (hasCustom) {
    let from: Date | undefined;
    let to: Date | undefined;
    if (fromRaw != null && fromRaw !== '') {
      from = new Date(String(fromRaw));
      if (Number.isNaN(from.getTime())) return { range: null, error: 'Invalid from date' };
    }
    if (toRaw != null && toRaw !== '') {
      to = new Date(String(toRaw));
      if (Number.isNaN(to.getTime())) return { range: null, error: 'Invalid to date' };
      to.setHours(23, 59, 59, 999);
    }
    const r: { from?: Date; to?: Date } = {};
    if (from !== undefined) r.from = from;
    if (to !== undefined) r.to = to;
    return { range: r };
  }

  if (rangeRaw == null || rangeRaw === '') return { range: null };

  const r = String(rangeRaw).toLowerCase().trim();
  const end = new Date();
  let start: Date;
  if (r === '7d') {
    start = new Date(end.getTime() - 7 * 86400000);
  } else if (r === '30d') {
    start = new Date(end.getTime() - 30 * 86400000);
  } else if (r === '12m') {
    start = new Date(end);
    start.setFullYear(start.getFullYear() - 1);
  } else {
    return { range: null, error: 'Invalid range (use 7d, 30d, 12m)' };
  }
  return { range: { from: start, to: end } };
}

export function matchCreatedRange(range: AnalyticsDateRange): Record<string, unknown> {
  if (!range || (!range.from && !range.to)) return {};
  const q: Record<string, unknown> = {};
  if (range.from) q.$gte = range.from;
  if (range.to) q.$lte = range.to;
  return { createdAt: q };
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function startOfTodayUtc(): Date {
  const t = new Date();
  t.setUTCHours(0, 0, 0, 0);
  return t;
}

function last12MonthBuckets(): Array<{ y: number; m: number; key: string; label: string }> {
  const out: Array<{ y: number; m: number; key: string; label: string }> = [];
  const d = new Date();
  for (let i = 11; i >= 0; i--) {
    const dt = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const y = dt.getFullYear();
    const m = dt.getMonth() + 1;
    const key = `${y}-${String(m).padStart(2, '0')}`;
    out.push({ y, m, key, label: `${MONTH_SHORT[m - 1]} ${y}` });
  }
  return out;
}

export type AdminAnalyticsPayload = {
  summary: {
    totalOrders: number;
    completedOrders: number;
    receivedOrders: number;
    pendingOrders: number;
    overdueOrders: number;
    completionRate: number;
    avgTurnaroundDays: number | null;
  };
  charts: {
    monthlyTrend: Array<{ month: string; created: number; completed: number }>;
    ordersByKarigar: Array<{ name: string; total: number }>;
    ordersByStaff: Array<{ name: string; total: number }>;
    ordersByJewelleryType: Array<{ type: string; total: number }>;
    statusBreakdown: Array<{ status: string; total: number }>;
  };
  recentStats: {
    thisMonthCreated: number;
    thisMonthCompleted: number;
  };
};

export async function buildAdminAnalytics(
  OrderModel: OrderModel,
  query: Record<string, unknown>
): Promise<{ payload: AdminAnalyticsPayload; debug: Record<string, unknown> }> {
  const { range: parsedRange, error: rangeErr } = parseAnalyticsRange(query);
  if (rangeErr) {
    throw new Error(rangeErr);
  }

  const createdMatch = matchCreatedRange(parsedRange);
  const preMatch: mongoose.PipelineStage[] =
    Object.keys(createdMatch).length > 0 ? [{ $match: createdMatch as mongoose.FilterQuery<unknown> }] : [];

  const basePipeline: mongoose.PipelineStage[] = [...preMatch, statusNormalizeStage()];

  const totalOrdersInDb = await OrderModel.countDocuments();
  const matchedForSummary = await OrderModel.countDocuments(
    createdMatch as mongoose.FilterQuery<unknown>
  );

  const [
    summaryAgg,
    overdueAgg,
    avgTurnaroundAgg,
    byKarigar,
    byStaff,
    byJewellery,
    statusBreak,
    createdByMonth,
    completedByMonth,
    recentFacet,
  ] = await Promise.all([
    OrderModel.aggregate<{ total: number; completed: number; received: number; pending: number }>([
      ...basePipeline,
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $in: ['$_status', TERMINAL] }, 1, 0] } },
          received: { $sum: { $cond: [{ $in: ['$_status', RECEIVED_ONLY] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $in: ['$_status', PENDING_LIKE] }, 1, 0] } },
        },
      },
    ]),
    OrderModel.aggregate<{ n: number }>([
      ...basePipeline,
      {
        $match: {
          expectedDeliveryDate: { $exists: true, $ne: null, $lt: startOfTodayUtc() },
          _status: { $ne: 'RECEIVED' },
        },
      },
      { $count: 'n' },
    ]),
    OrderModel.aggregate<{ avg: number | null }>([
      ...basePipeline,
      { $match: { _status: { $in: RECEIVED_ONLY } } },
      {
        $addFields: {
          _receivedTs: {
            $let: {
              vars: {
                recLogs: {
                  $filter: {
                    input: { $ifNull: ['$statusLogs', []] },
                    as: 'sl',
                    cond: {
                      $eq: [
                        { $toUpper: { $trim: { input: { $ifNull: ['$$sl.status', ''] } } } },
                        'RECEIVED',
                      ],
                    },
                  },
                },
              },
              in: {
                $ifNull: [{ $max: '$$recLogs.createdAt' }, '$updatedAt'],
              },
            },
          },
        },
      },
      {
        $match: {
          _receivedTs: { $type: 'date' },
          createdAt: { $type: 'date' },
        },
      },
      {
        $project: {
          days: { $divide: [{ $subtract: ['$_receivedTs', '$createdAt'] }, 86400000] },
        },
      },
      { $group: { _id: null, avg: { $avg: '$days' } } },
    ]),
    OrderModel.aggregate([
      ...basePipeline,
      { $group: { _id: '$assignedTo', total: { $sum: 1 } } },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'u',
        },
      },
      { $unwind: { path: '$u', preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, name: { $ifNull: ['$u.name', 'Unknown'] }, total: 1 } },
      { $sort: { total: -1 } },
    ]),
    OrderModel.aggregate([
      ...basePipeline,
      { $group: { _id: '$createdBy', total: { $sum: 1 } } },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'u',
        },
      },
      { $unwind: { path: '$u', preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, name: { $ifNull: ['$u.name', 'Unknown'] }, total: 1 } },
      { $sort: { total: -1 } },
    ]),
    OrderModel.aggregate([
      ...basePipeline,
      {
        $group: {
          _id: { $ifNull: ['$jewelleryType', 'Unknown'] },
          total: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
      { $project: { _id: 0, type: '$_id', total: 1 } },
    ]),
    OrderModel.aggregate([
      ...basePipeline,
      { $group: { _id: '$_status', total: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
    OrderModel.aggregate<{ _id: { y: number; m: number }; created: number }>([
      ...basePipeline,
      {
        $group: {
          _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } },
          created: { $sum: 1 },
        },
      },
    ]),
    OrderModel.aggregate<{ _id: { y: number; m: number }; completed: number }>([
      ...basePipeline,
      { $match: { _status: { $in: TERMINAL } } },
      {
        $group: {
          _id: { y: { $year: '$updatedAt' }, m: { $month: '$updatedAt' } },
          completed: { $sum: 1 },
        },
      },
    ]),
    OrderModel.aggregate<{ thisMonthCreated: { n: number }[]; thisMonthCompleted: { n: number }[] }>([
      ...basePipeline,
      {
        $facet: {
          thisMonthCreated: [
            { $match: { createdAt: { $gte: startOfMonth(new Date()) } } },
            { $count: 'n' },
          ],
          thisMonthCompleted: [
            {
              $match: {
                _status: { $in: TERMINAL },
                updatedAt: { $gte: startOfMonth(new Date()) },
              },
            },
            { $count: 'n' },
          ],
        },
      },
    ]),
  ]);

  const s = summaryAgg[0];
  const totalOrders = s?.total ?? 0;
  const completedOrders = s?.completed ?? 0;
  const receivedOrders = s?.received ?? 0;
  const pendingOrders = s?.pending ?? 0;
  const overdueOrders = overdueAgg[0]?.n ?? 0;

  const avgRaw = avgTurnaroundAgg[0]?.avg ?? null;
  const avgTurnaroundDays =
    avgRaw != null && Number.isFinite(avgRaw) ? Math.round(avgRaw * 100) / 100 : null;

  const completionRate =
    totalOrders > 0 ? Math.round((receivedOrders / totalOrders) * 10000) / 100 : 0;

  const buckets = last12MonthBuckets();
  const createdMap = new Map<string, number>();
  for (const row of createdByMonth) {
    if (!row._id) continue;
    const key = `${row._id.y}-${String(row._id.m).padStart(2, '0')}`;
    createdMap.set(key, row.created);
  }
  const completedMap = new Map<string, number>();
  for (const row of completedByMonth) {
    if (!row._id) continue;
    const key = `${row._id.y}-${String(row._id.m).padStart(2, '0')}`;
    completedMap.set(key, row.completed ?? 0);
  }

  const monthlyTrend = buckets.map((b) => ({
    month: b.label,
    created: createdMap.get(b.key) ?? 0,
    completed: completedMap.get(b.key) ?? 0,
  }));

  const statusBreakdown = statusBreak.map((row) => ({
    status: STATUS_LABEL[String(row._id)] ?? String(row._id),
    total: row.total,
  }));

  const recent = recentFacet[0];
  const thisMonthCreated = recent?.thisMonthCreated?.[0]?.n ?? 0;
  const thisMonthCompleted = recent?.thisMonthCompleted?.[0]?.n ?? 0;

  const payload: AdminAnalyticsPayload = {
    summary: {
      totalOrders,
      completedOrders,
      receivedOrders,
      pendingOrders,
      overdueOrders,
      completionRate,
      avgTurnaroundDays,
    },
    charts: {
      monthlyTrend,
      ordersByKarigar: byKarigar as AdminAnalyticsPayload['charts']['ordersByKarigar'],
      ordersByStaff: byStaff as AdminAnalyticsPayload['charts']['ordersByStaff'],
      ordersByJewelleryType: byJewellery as AdminAnalyticsPayload['charts']['ordersByJewelleryType'],
      statusBreakdown,
    },
    recentStats: {
      thisMonthCreated,
      thisMonthCompleted,
    },
  };

  const debug = {
    totalOrdersInDb,
    matchedOrdersForDateFilter: matchedForSummary,
    dateFilter: createdMatch,
    summaryAggRaw: s ?? null,
  };

  return { payload, debug };
}
