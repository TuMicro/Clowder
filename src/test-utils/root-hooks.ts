// overwriting the enviroment variables with the ones on the .env.test file
import * as dotenv from 'dotenv';
import path from "node:path";
dotenv.config({
  path: path.resolve(process.cwd(), '.env.test'),
  override: true,
});

console.log("You are testing locally connected to the project: " + process.env.GCLOUD_PROJECT + ". See firebase-init to change it.");

export const mochaHooks = {
  beforeAll: function() {
    // global setup for all tests
  },
  // beforeEach: function() {
  // },
  afterAll: function() {
    // one-time final cleanup
  }
};