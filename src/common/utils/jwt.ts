import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { config } from "../../config/index.js";

export interface AccessTokenPayload {
  sub: string;
  role: string;
  type: "access";
}

export interface RefreshTokenPayload {
  sub: string;
  type: "refresh";
}

export function signAccessToken(userId: string, role: string): string {
  const payload: AccessTokenPayload = { sub: userId, role, type: "access" };
  const options: SignOptions = {
    expiresIn: config.jwtAccessExpires as SignOptions["expiresIn"],
  };
  return jwt.sign(payload, config.jwtAccessSecret, options);
}

export function signRefreshToken(userId: string): string {
  const payload: RefreshTokenPayload = { sub: userId, type: "refresh" };
  const options: SignOptions = {
    expiresIn: config.jwtRefreshExpires as SignOptions["expiresIn"],
  };
  return jwt.sign(payload, config.jwtRefreshSecret, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, config.jwtAccessSecret) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, config.jwtRefreshSecret) as RefreshTokenPayload;
}