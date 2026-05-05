import { Parser } from 'json2csv';
import PDFDocument from 'pdfkit';
import { Order } from '../models/order.model.js';
export const exportOrdersCSV = async (res) => {
    const orders = await Order.find().populate('createdBy assignedTo', 'name');
    const fields = ['orderCode', 'jewelleryType', 'metalType', 'status', 'totalAmount', 'advancePaid', 'createdAt'];
    const opts = { fields };
    const parser = new Parser(opts);
    const csv = parser.parse(orders);
    res.header('Content-Type', 'text/csv');
    res.attachment('orders.csv');
    return res.send(csv);
};
export const exportOrdersPDF = async (res) => {
    const orders = await Order.find().populate('createdBy assignedTo', 'name');
    const doc = new PDFDocument();
    res.header('Content-Type', 'application/pdf');
    res.attachment('orders.pdf');
    doc.pipe(res);
    doc.fontSize(20).text('Order Report', { align: 'center' });
    doc.moveDown();
    orders.forEach(order => {
        doc.fontSize(12).text(`Order: ${order.orderCode} | Type: ${order.jewelleryType} | Status: ${order.status}`);
        doc.text(`Staff: ${order.createdBy.name} | Karigar: ${order.assignedTo.name}`);
        doc.text(`Amount: ${order.totalAmount} | Advance: ${order.advancePaid}`);
        doc.moveDown();
    });
    doc.end();
};
import QRCode from 'qrcode';
export const generateOrderSlipPDF = async (orderId, res) => {
    const order = await Order.findById(orderId).populate('createdBy assignedTo', 'name');
    if (!order)
        throw new Error('Order not found');
    const doc = new PDFDocument();
    res.header('Content-Type', 'application/pdf');
    res.attachment(`order-slip-${order.orderCode}.pdf`);
    doc.pipe(res);
    doc.fontSize(25).text('GoldLink Pro - Order Slip', { align: 'center' });
    doc.moveDown();
    // Create QR Data (URL to order details)
    const qrData = `https://goldlinkpro.com/orders/${order._id}`;
    const qrBuffer = await QRCode.toBuffer(qrData);
    doc.image(qrBuffer, doc.page.width - 150, 50, { width: 100 });
    doc.fontSize(14).text(`Order Code: ${order.orderCode}`);
    doc.text(`Date: ${order.createdAt.toLocaleDateString()}`);
    doc.text(`Customer Ref: ${order.customerRef || 'N/A'}`);
    doc.moveDown();
    doc.text(`Jewellery: ${order.jewelleryType} (${order.metalType})`);
    doc.text(`Weight: ${order.weight || 'N/A'}`);
    doc.text(`Design Notes: ${order.designNotes || 'N/A'}`);
    doc.moveDown();
    doc.text(`Total Amount: ${order.totalAmount}`);
    doc.text(`Advance Paid: ${order.advancePaid}`);
    doc.text(`Balance Due: ${order.totalAmount - (order.advancePaid || 0)}`);
    doc.moveDown();
    doc.text('Scan for details:', { oblique: true });
    doc.end();
};
//# sourceMappingURL=export.service.js.map