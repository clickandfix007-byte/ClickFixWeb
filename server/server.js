
import "dotenv/config";
import express from "express";
import cors from "cors";
import pool from "./db.js";

import servicesRouter from "./routes/services.js";
import authRouter from "./routes/auth.js";
import bookingsRouter from "./routes/bookings.js";
import adminRouter from "./routes/admin.js";

const app = express();

// CORS configuration
app.use(cors({
  origin: [
    "http://localhost:4173",
    "http://localhost:4174"
  ]
}));

// Middleware
app.use(express.json());

// Welcome route
app.get("/", (req, res) => {
  res.json({
    message: "Welcome to Click & Fix Backend API",
    status: "Running"
  });
});

// Database health check
app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        NOW() AS server_time,
        current_database() AS database
    `);

    res.json({
      status: "success",
      message: "Click & Fix backend connected to PostgreSQL",
      database: result.rows[0].database,
      serverTime: result.rows[0].server_time
    });
  } catch (error) {
    console.error("Database health check error:", error.message);

    res.status(500).json({
      status: "error",
      message: "Database connection failed"
    });
  }
});

// API routes
app.use("/api/services", servicesRouter);
app.use("/api/auth", authRouter);
app.use("/api/bookings", bookingsRouter);

// Admin API routes
app.use("/api/admin", adminRouter);

// Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Click & Fix API running at http://localhost:${PORT}`);
  console.log("Customer API: /api");
  console.log("Technician API: /api/bookings/technician");
  console.log("Admin API: /api/admin");
});
