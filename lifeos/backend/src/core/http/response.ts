import { Response } from "express";

export const ok = <T>(res: Response, data: T, message = "ok") => {
  return res.status(200).json({ message, data });
};
