
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomInt } from "node:crypto";
import pool from "../db.js";

const router = express.Router();

const allowedRoles = ["customer", "technician"];

function normalizePhone(phone) {
  return String(phone || "").replace(/[\s()-]/g, "");
}

// Request OTP
router.post("/request-otp", async (req, res) => {
  const { phone, role, purpose = "login" } = req.body;

  if (!phone || !allowedRoles.includes(role)) {
    return res.status(400).json({
      success: false,
      message: "Valid phone and role are required"
    });
  }

  if (!["login", "register"].includes(purpose)) {
    return res.status(400).json({
      success: false,
      message: "Invalid purpose"
    });
  }

  const cleanPhone = normalizePhone(phone);

  if (!/^\+?[1-9]\d{7,14}$/.test(cleanPhone)) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid phone number with country code"
    });
  }

  try {
    const existing = await pool.query(
      "SELECT id, role FROM users WHERE phone = $1",
      [cleanPhone]
    );

    if (purpose === "register" && existing.rows.length) {
      return res.status(409).json({
        success: false,
        message: "This phone number is already registered"
      });
    }

    if (purpose === "login" &&
        (!existing.rows.length || existing.rows[0].role !== role)) {
      return res.status(404).json({
        success: false,
        message: "Account not found for this role"
      });
    }

    const recent = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM otp_verifications
       WHERE phone = $1
       AND created_at > NOW() - INTERVAL '15 minutes'`,
      [cleanPhone]
    );

    if (recent.rows[0].count >= 5) {
      return res.status(429).json({
        success: false,
        message: "Too many OTP requests. Try again later."
      });
    }

    const otp = String(randomInt(100000, 1000000));
    const otpHash = await bcrypt.hash(otp, 10);

    await pool.query(
      `INSERT INTO otp_verifications
       (phone, role, purpose, otp_hash, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '5 minutes')`,
      [cleanPhone, role, purpose, otpHash]
    );

    const response = {
      success: true,
      message: "OTP generated. It expires in 5 minutes."
    };

    // Development only: never return OTP in production.
    if (
      process.env.NODE_ENV !== "production" &&
      process.env.DEV_OTP_ENABLED === "true"
    ) {
      response.devOtp = otp;
    }

    return res.json(response);
  } catch (error) {
    console.error("OTP request error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to request OTP"
    });
  }
});

// Verify OTP and register/login
router.post("/verify-otp", async (req, res) => {
  const { phone, role, purpose = "login", otp, fullName } = req.body;

  if (!phone || !allowedRoles.includes(role) ||
      !/^\d{6}$/.test(String(otp || ""))) {
    return res.status(400).json({
      success: false,
      message: "Phone, role and six-digit OTP are required"
    });
  }

  if (!["login", "register"].includes(purpose)) {
    return res.status(400).json({
      success: false,
      message: "Invalid purpose"
    });
  }

  const cleanPhone = normalizePhone(phone);

  try {
    const result = await pool.query(
      `SELECT *
       FROM otp_verifications
       WHERE phone = $1
       AND role = $2
       AND purpose = $3
       AND verified_at IS NULL
       AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [cleanPhone, role, purpose]
    );

    if (!result.rows.length) {
      return res.status(400).json({
        success: false,
        message: "OTP expired or not found. Request a new OTP."
      });
    }

    const record = result.rows[0];

    if (record.attempts >= 5) {
      return res.status(429).json({
        success: false,
        message: "Too many incorrect attempts. Request a new OTP."
      });
    }

    const matches = await bcrypt.compare(
      String(otp),
      record.otp_hash
    );

    if (!matches) {
      await pool.query(
        "UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = $1",
        [record.id]
      );

      return res.status(400).json({
        success: false,
        message: "Incorrect OTP"
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      await client.query(
        "UPDATE otp_verifications SET verified_at = NOW() WHERE id = $1",
        [record.id]
      );

      let userResult;

      if (purpose === "register") {
        if (!fullName || !String(fullName).trim()) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            success: false,
            message: "Full name is required for registration"
          });
        }

        userResult = await client.query(
          `INSERT INTO users (full_name, phone, role)
           VALUES ($1, $2, $3)
           RETURNING id, full_name, phone, role`,
          [String(fullName).trim(), cleanPhone, role]
        );

        if (role === "technician") {
          await client.query(
            `INSERT INTO technician_profiles (user_id)
             VALUES ($1)`,
            [userResult.rows[0].id]
          );
        }
      } else {
        userResult = await client.query(
          `SELECT id, full_name, phone, role
           FROM users
           WHERE phone = $1 AND role = $2 AND is_active = TRUE`,
          [cleanPhone, role]
        );

        if (!userResult.rows.length) {
          await client.query("ROLLBACK");
          return res.status(404).json({
            success: false,
            message: "Active account not found"
          });
        }
      }

      await client.query("COMMIT");

      const user = userResult.rows[0];

      if (!process.env.JWT_SECRET ||
          process.env.JWT_SECRET.length < 32) {
        return res.status(500).json({
          success: false,
          message: "Server authentication configuration is missing"
        });
      }

      const token = jwt.sign(
        { userId: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
      );

      return res.json({
        success: true,
        message: "Authentication successful",
        token,
        user
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("OTP verification error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to verify OTP"
    });
  }
});

export default router;
