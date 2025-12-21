import dotenv from "dotenv";
import connectDB from "./db/index.js";

dotenv.config({ path: "./.env" });

console.log(
  "MONGODB_URI:",
  process.env.MONGODB_URI ? "Loaded" : "Not loaded"
);

connectDB();