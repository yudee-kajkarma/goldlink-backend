import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isReservedChatPathSegment } from '../src/constants/chat.constants.js';
import { isOrderChatParticipant } from '../src/utils/chatAccess.util.js';
import { isAllowedChatDocument } from '../src/constants/media.constants.js';
import { normalizeOrderPriority } from '../src/utils/orderPriority.util.js';
import { buildOrderSearchFilter } from '../src/utils/orderSearch.util.js';
import { markChatReadBodySchema, sendChatVoiceBodySchema } from '../src/validators/schemas.js';

test('chat: reserved path segments include read/unread/orders', () => {
  assert.equal(isReservedChatPathSegment('read'), true);
  assert.equal(isReservedChatPathSegment('unread'), true);
  assert.equal(isReservedChatPathSegment('orders'), true);
  assert.equal(isReservedChatPathSegment('507f1f77bcf86cd799439011'), false);
});

test('chat access: order creator and assignee are participants, others are not', () => {
  const creator = '507f1f77bcf86cd799439011';
  const karigar = '507f1f77bcf86cd799439012';
  const stranger = '507f1f77bcf86cd799439013';
  const order = { createdBy: creator, assignedTo: karigar };

  assert.equal(isOrderChatParticipant(order, creator), true);
  assert.equal(isOrderChatParticipant(order, karigar), true);
  assert.equal(isOrderChatParticipant(order, stranger), false);
  assert.equal(isOrderChatParticipant(order, undefined), false);
});

test('chat access: handles populated user refs and ObjectId-like values', () => {
  const creator = '507f1f77bcf86cd799439011';
  const karigar = '507f1f77bcf86cd799439012';
  const order = {
    createdBy: { _id: creator, name: 'Admin' },
    assignedTo: { toString: () => karigar },
  };

  assert.equal(isOrderChatParticipant(order, creator), true);
  assert.equal(isOrderChatParticipant(order, karigar), true);
  assert.equal(isOrderChatParticipant(order, '507f1f77bcf86cd799439013'), false);
});

test('chat documents: accepts office formats by mimetype', () => {
  assert.equal(isAllowedChatDocument('application/pdf', 'report.pdf'), true);
  assert.equal(
    isAllowedChatDocument(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'letter.docx',
    ),
    true,
  );
  assert.equal(
    isAllowedChatDocument(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'rates.xlsx',
    ),
    true,
  );
  assert.equal(isAllowedChatDocument('application/msword', 'letter.doc'), true);
  assert.equal(isAllowedChatDocument('application/vnd.ms-excel', 'rates.xls'), true);
  assert.equal(isAllowedChatDocument('text/csv', 'orders.csv'), true);
  assert.equal(isAllowedChatDocument('text/plain', 'notes.txt'), true);
});

test('chat documents: falls back to extension when picker reports octet-stream', () => {
  assert.equal(isAllowedChatDocument('application/octet-stream', 'report.pdf'), true);
  assert.equal(isAllowedChatDocument('application/octet-stream', 'rates.csv'), true);
  assert.equal(isAllowedChatDocument('application/octet-stream', 'virus.exe'), false);
});

test('chat documents: rejects executables and unknown types', () => {
  assert.equal(isAllowedChatDocument('application/x-msdownload', 'setup.exe'), false);
  assert.equal(isAllowedChatDocument('application/javascript', 'script.js'), false);
  assert.equal(isAllowedChatDocument('', ''), false);
});

test('order priority: legacy HIGH/LOW maps', () => {
  assert.equal(normalizeOrderPriority('HIGH'), 'URGENT');
  assert.equal(normalizeOrderPriority('LOW'), 'NORMAL');
  assert.equal(normalizeOrderPriority('EXPRESS'), 'EXPRESS');
});

test('order search: empty string yields empty filter', () => {
  assert.deepEqual(buildOrderSearchFilter(''), {});
  assert.deepEqual(buildOrderSearchFilter('   '), {});
});

test('order search: builds $or regex filter', () => {
  const f = buildOrderSearchFilter('ORD');
  assert.ok('$or' in f);
});

test('validation: markChatRead accepts 24-char hex', () => {
  const id = '507f1f77bcf86cd799439011';
  const p = markChatReadBodySchema.safeParse({ orderId: id });
  assert.equal(p.success, true);
});

test('validation: markChatRead rejects invalid id', () => {
  const p = markChatReadBodySchema.safeParse({ orderId: 'not-an-id' });
  assert.equal(p.success, false);
});

test('validation: voice multipart body duration max 120', () => {
  const ok = sendChatVoiceBodySchema.safeParse({
    orderId: '507f1f77bcf86cd799439011',
    duration: 120,
  });
  assert.equal(ok.success, true);
  const bad = sendChatVoiceBodySchema.safeParse({
    orderId: '507f1f77bcf86cd799439011',
    duration: 121,
  });
  assert.equal(bad.success, false);
});
