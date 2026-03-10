import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ENV } from "../config/env";
import { JwtUserPayload } from "../modules/auth/jwt-payload";
export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: "Token requerido" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as JwtUserPayload;

    if (typeof decoded === "string") {
      throw new Error("Payload inválido");
    }
    req.user = decoded;
    next();
  } catch (error) {
    console.error("JWT ERROR:", error);
    return res.status(401).json({ message: "Token inválido" });
  }
};
