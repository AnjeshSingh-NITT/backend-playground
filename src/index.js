import dotenv from "dotenv";
import connectDB from "./db/index.js";
import { app } from "./app.js";

dotenv.config({ path: "./.env" });

console.log(
  "MONGODB_URI:",
  process.env.MONGODB_URI ? "Loaded" : "Not loaded"
);

connectDB()
.then(() => {
    const server = app.listen(process.env.PORT || 8000, () => {
        console.log(`Server is running on port ${process.env.PORT || 8000}`);
    })
    server.on("error", (error) => {
        console.error("Server error:", error);
    });
})
.catch((error) => {
    console.error("FAILED to connect to the database:", error);
});