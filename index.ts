import express from "express";
import mongoose, { model, Schema } from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import type { Seat, Service } from "./types.js";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const SeatSchema = new Schema<Seat>({
  number: Number,
  status: { type: String, enum: ["FREE", "LOCKED", "BOOKED"], default: "FREE" },
  lockedBy: String,
  lockedUntil: Date,
});

const ServiceSchema = new Schema<Service>({
  name: String,
  from: { type: String, index: true },
  to: { type: String, index: true },
  date: { type: String, index: true },
  departureTime: String,
  price: Number,
  seats: [SeatSchema],
});

const LOCK_DURATION = 3 * 60 * 1000;
const CLEANUP_INTERVAL = LOCK_DURATION / 2;

export const ServiceModel = model<Service>("Service", ServiceSchema);

const MONGO_DB_STRING = process.env.MONGO_URI ?? "";
mongoose
  .connect(MONGO_DB_STRING)
  .then(() => console.log("Mongo connected"))
  .catch(() => console.error);

/* ================== AUTO UNLOCK ================== */

setInterval(async () => {
  const now = new Date();
  await ServiceModel.updateMany(
    { "seats.status": "LOCKED", "seats.lockedUntil": { $lt: now } },
    {
      $set: { "seats.$[seat].status": "FREE" },
      $unset: { "seats.$[seat].lockedBy": "", "seats.$[seat].lockedUntil": "" },
    },
    {
      arrayFilters: [
        { "seat.status": "LOCKED", "seat.lockedUntil": { $lt: now } },
      ],
    }
  );
}, CLEANUP_INTERVAL);

/* ================== ROUTES ================== */

// Create service
app.post("/api/services", async (req: any, res: any) => {
  const { name, from, to, date, departureTime, price, totalSeats } = req.body;

  if (
    !name ||
    !from ||
    !to ||
    !date ||
    !departureTime ||
    !price ||
    !totalSeats
  ) {
    return res.status(400).json({ message: "Missing fields" });
  }

  const seats = Array.from({ length: totalSeats }, (_, i) => ({
    number: i + 1,
    status: "FREE" as "FREE" | "LOCKED" | "BOOKED",
  }));

  const service = await ServiceModel.create({
    name,
    from,
    to,
    date,
    departureTime,
    price,
    seats,
  });

  res.status(201).json(service);
});

// Search services
app.get("/api/services", async (req: any, res: any) => {
  const { from, to, date } = req.query;
  const services = await ServiceModel.find({ from, to, date });
  res.json(services);
});

// Get a service
app.get("/api/services/:id", async (req: any, res: any) => {
  const service = await ServiceModel.findById(req.params.id);
  res.json(service);
});

// Lock Seat
app.post(
  "/api/services/:serviceId/seats/:seatId/lock",
  async (req: any, res: any) => {
    const { serviceId, seatId } = req.params;

    const service = await ServiceModel.findById(serviceId);
    if (!service) return res.status(404).json({ message: "Service not found" });

    const seat = service.seats.find((seat) => seat._id.toString() === seatId);
    if (!seat) return res.status(404).json({ message: "Seat not found" });

    if (seat.status == "LOCKED") {
      return res.status(409).json({ message: "Selected seat is already locked" });
    }
    if (seat.status == "BOOKED") {
      return res.status(409).json({ message: "Seat already booked" });
    }

    seat.status = "LOCKED";
    seat.lockedUntil = new Date(Date.now() + LOCK_DURATION);
    await service.save();

    res.json({ message: "Seat locked", lockedUntil: seat.lockedUntil });
  }
);

// Book Seat
app.post(
  "/api/services/:serviceId/seats/:seatId/book",
  async (req: any, res: any) => {
    const { serviceId, seatId } = req.params;

    const service = await ServiceModel.findById(serviceId);
    if (!service) return res.status(404).json({ message: "Service not found" });

    const seat = service.seats.find((seat) => seat._id.toString() === seatId);
    if (!seat) return res.status(404).json({ message: "Seat not found" });

    if (seat.status === "FREE") {
      return res.status(409).json({ message: "Seat is not locked yet" });
    }

    if (seat.status === "BOOKED") {
      return res.status(409).json({ message: "Seat already booked" });
    }

    seat.status = "BOOKED";
    seat.lockedBy = undefined;
    seat.lockedUntil = undefined;

    await service.save();

    res.json({ message: "Seat booked" });
  }
);

app.listen(4000, () => console.log("Server running on 4000"));
