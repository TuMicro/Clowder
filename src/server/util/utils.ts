import { Response } from "express";

export function logAndAnswer(res: Response, body: any) {
  console.log("Response body:");
  console.log(JSON.stringify(body));
  res.json(body)
}