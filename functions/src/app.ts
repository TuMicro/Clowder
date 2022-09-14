import express from "express";
import cors from "cors";
import { routerV2 } from "./server/router";
import { logAndAnswer } from "./server/util/utils";
import { isTesting } from "./util/devEnv";

const app = express();


// common endpoints:

app.use(cors()); // allowing all origins for now
app.use(express.json())

app.get("/isTestingEnv", async function (req, res) {
  const i = isTesting();
  console.log("isTesting: ", i);
  res.json({
    status: 'OK',
    isTesting: i,
  });
});

app.get("/crashNotificationTester", async function (req, res) {
  try {
    throw new Error('crashNotificationTester');
  } catch (e) {
    logAndAnswer(res, e);
  }

});

// dummy endpoint that just returns OK:
app.get("/", async function (req, res) {
  console.log(JSON.stringify(req.query));
  res.json({
    status: 'OK'
  });
});

app.use("/api/v1", routerV2);

export const endpoints = app;