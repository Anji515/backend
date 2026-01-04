import { Types } from "mongoose";

export interface Seat {
  _id: Types.ObjectId;
  number: number;
  status: "FREE" | "LOCKED" | "BOOKED";
  lockedBy?: string;
  lockedUntil?: Date;
}

export interface Service {
  name: string;
  from: string;
  to: string;
  date: string;
  departureTime: string;
  price: number;
  seats: Seat[];
}