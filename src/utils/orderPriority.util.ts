import { ORDER_PRIORITIES, type OrderPriority } from '../constants/order.constants.js';

export function normalizeOrderPriority(raw: unknown): OrderPriority {
  if (raw === 'HIGH') return 'URGENT';
  if (raw === 'LOW') return 'NORMAL';
  if (typeof raw === 'string' && (ORDER_PRIORITIES as readonly string[]).includes(raw)) {
    return raw as OrderPriority;
  }
  return 'NORMAL';
}
