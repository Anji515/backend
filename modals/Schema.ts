import { Schema } from "mongoose";
import type { Seat, Service } from "../types.js";

const SeatSchema = new Schema<Seat>({
  number: Number,
  status: { type: String, enum: ["FREE", "LOCKED", "BOOKED"], default: "FREE" },
  lockedBy: String,
  lockedUntil: Date,
});

export const ServiceSchema = new Schema<Service>({
  name: String,
  from: { type: String, index: true },
  to: { type: String, index: true },
  date: { type: String, index: true },
  departureTime: String,
  price: Number,
  seats: [SeatSchema],
});