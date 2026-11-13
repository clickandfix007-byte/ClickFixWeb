
import jwt from "jsonwebtoken";

export function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Login required"
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.userId || !decoded.role) {
      return res.status(401).json({
        success: false,
        message: "Invalid login token"
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Session expired or invalid. Please log in again."
    });
  }
}

export function requireCustomer(req, res, next) {
  if (req.user?.role !== "customer") {
    return res.status(403).json({
      success: false,
      message: "Customer account required"
    });
  }

  next();
}

export function requireTechnician(req, res, next) {
  if (req.user?.role !== "technician") {
    return res.status(403).json({
      success: false,
      message: "Technician account required"
    });
  }

  next();
}
