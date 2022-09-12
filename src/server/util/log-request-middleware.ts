import { RequestHandler } from "express";

export const logRequest : RequestHandler = (req, res, next) => {
  console.log(req.path);
  console.log(JSON.stringify(req.body));
  console.log("userId: " + res.locals?.userId);
  next();
}