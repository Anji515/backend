import express from 'express';
import mongoose, { model, Schema } from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
const SeatSchema = new Schema({
    number: Number,
    status: { type: String, enum: ['FREE', 'LOCKED', 'BOOKED'], default: 'FREE' },
    lockedBy: String,
    lockedUntil: Date
});
const ServiceSchema = new Schema({
    name: String,
    from: { type: String, index: true },
    to: { type: String, index: true },
    date: { type: String, index: true },
    departureTime: String,
    price: Number,
    seats: [SeatSchema]
});
export const ServiceModel = model('Service', ServiceSchema);
dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
/* ================== MONGOOSE ================== */
const MONGO_DB_STRING = process.env.MONGO_URI ?? '';
/* ================== DB CONNECT ================== */
mongoose.connect(MONGO_DB_STRING)
    .then(() => console.log('Mongo connected')).catch(console.error);
/* ================== AUTO UNLOCK ================== */
setInterval(async () => {
    const now = new Date();
    await ServiceModel.updateMany({ 'seats.status': 'LOCKED', 'seats.lockedUntil': { $lt: now } }, {
        $set: { 'seats.$[seat].status': 'FREE' },
        $unset: { 'seats.$[seat].lockedBy': '', 'seats.$[seat].lockedUntil': '' }
    }, { arrayFilters: [{ 'seat.status': 'LOCKED', 'seat.lockedUntil': { $lt: now } }] });
}, 60000);
/* ================== ROUTES ================== */
// Create service
app.post('/api/services', async (req, res) => {
    const { name, from, to, date, departureTime, price, totalSeats } = req.body;
    if (!name || !from || !to || !date || !departureTime || !price || !totalSeats) {
        return res.status(400).json({ message: 'Missing fields' });
    }
    const seats = Array.from({ length: totalSeats }, (_, i) => ({
        number: i + 1,
        status: 'FREE'
    }));
    const service = await ServiceModel.create({
        name, from, to, date, departureTime, price, seats
    });
    res.status(201).json(service);
});
// Search services
app.get('/api/services', async (req, res) => {
    const { from, to, date } = req.query;
    const services = await ServiceModel.find({ from, to, date });
    res.json(services);
});
// Get a service
app.get('/api/services/:id', async (req, res) => {
    const service = await ServiceModel.findById(req.params.id);
    res.json(service);
});
// Lock Seat
app.post('/api/services/:serviceId/seats/:seatId/lock', async (req, res) => {
    const { serviceId, seatId } = req.params;
    const result = await ServiceModel.updateOne({ _id: serviceId, 'seats._id': seatId, 'seats.status': 'FREE' }, {
        $set: {
            'seats.$.status': 'LOCKED',
            'seats.$.lockedUntil': new Date(Date.now() + 1 * 60 * 1000)
        }
    });
    if (result.modifiedCount === 0)
        return res.status(409).json({ message: 'Seat not available' });
    res.json({ message: 'Seat locked for 5 minutes' });
});
// Book Seat
app.post('/api/services/:serviceId/seats/:seatId/book', async (req, res) => {
    const { serviceId, seatId } = req.params;
    const result = await ServiceModel.updateOne({
        _id: serviceId,
        'seats._id': seatId,
        'seats.status': 'LOCKED',
    }, {
        $set: { 'seats.$.status': 'BOOKED' },
        $unset: { 'seats.$.lockedBy': '', 'seats.$.lockedUntil': '' }
    });
    if (result.modifiedCount === 0)
        return res.status(403).json({ message: 'Cannot book seat' });
    res.json({ message: 'Seat booked' });
});
app.listen(4000, () => console.log('Server running on 4000'));
