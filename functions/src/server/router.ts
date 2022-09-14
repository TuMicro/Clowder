import express from "express";
import { Response } from "express-serve-static-core";
import { getCollectionDataForClowder } from "../tasks/orbimarket";
import { isTesting } from "../util/devEnv";
import { getFirebaseAuthMiddleware } from "./util/express-firebase-middleware";
import { logAndAnswer } from "./util/utils";

export const routerV2 = express
  .Router()
  // declaring auth protected prefix
  .use("/p/", getFirebaseAuthMiddleware(isTesting() ? true : false))
  // declaring auth protected prefix but where authentication is optional
  .use("/po/", getFirebaseAuthMiddleware(true))

  //.get('/p/admin/dashboard/users', userHandlers.getDashboardUsers)

  .post('/po/orbimarket/getFloorPrice', async function (req, res) {

    const url = String(req.body.url);


    try {

      // validating event data
      const orbiCollectionData = await getCollectionDataForClowder(url, 5);

      logAndAnswer(res, {
        status: "OK",
        data: orbiCollectionData,
      });

    } catch (e) {
      logAndAnswer(res, {
        status: "ERROR",
        message: (e as any).message,
      });
    }
  })
