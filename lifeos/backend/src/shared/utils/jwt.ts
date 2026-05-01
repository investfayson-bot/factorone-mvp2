import jwt from "jsonwebtoken";

import { env } from "../../config/env";

export type AuthTokenPayload = {
  sub: string;
  email: string;
};

type JwtExpiresIn = Parameters<typeof jwt.sign>[2] extends infer T
  ? T extends { expiresIn?: infer E }
    ? E
    : never
  : never;

export const signAuthToken = (payload: AuthTokenPayload): string => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as JwtExpiresIn
  });
};

export const verifyAuthToken = (token: string): AuthTokenPayload => {
  return jwt.verify(token, env.JWT_SECRET) as AuthTokenPayload;
};
