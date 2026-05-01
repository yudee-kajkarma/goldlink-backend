import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from '../models/order.model.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI as string;

async function checkOrder() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to DB');

    const orderId = '69f454bba3a14ad22888b872';
    const order = await Order.findById(orderId);

    if (!order) {
      console.log(`Order ${orderId} NOT FOUND in DB!`);
    } else {
      console.log(`Order Found!`);
      console.log(`Order ID: ${order._id}`);
      console.log(`Created By (Staff):`, order.createdBy);
      console.log(`Assigned To (Karigar):`, order.assignedTo);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

checkOrder();
