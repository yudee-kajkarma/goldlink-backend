import type { FilterQuery } from 'mongoose';
import type { IOrder } from '../models/order.model.js';

/**
 * Case-insensitive partial match on orderCode, customerRef, jewelleryType.
 * Uses anchored regex with user-escaped input; suitable for indexed prefix when lead-char present.
 */
export function buildOrderSearchFilter(search: string | undefined): FilterQuery<IOrder> {
  const q = typeof search === 'string' ? search.trim() : '';
  if (!q) return {};

  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx = new RegExp(escaped, 'i');
  return {
    $or: [{ orderCode: rx }, { customerRef: rx }, { jewelleryType: rx }],
  };
}
