import { initializeApp, getApps } from 'firebase-admin/app';
//import { isTesting } from './util/devEnv';

// Init Firebase:

// let serviceAccount = null;
// try {
//   serviceAccount = require('./../sweat-equity-01-firebase-adminsdk-mcz1a-aaceb9685b.json');  
// } catch (error) {
//   console.log(error);
// }
// let config = {
//   credential: serviceAccount? 
//     admin.credential.cert(serviceAccount): 
//     admin.credential.applicationDefault()
// };

// console.log(`GCLOUD_PROJECT: ${process.env.GCLOUD_PROJECT ?? "undefined"}`); // returns undefined in local testing

// setting up the project id in case non-existant, required for local testing
process.env.GCLOUD_PROJECT ??= 
  //'sweat-equity-test' ;
   'clowder-club'; 

//console.log(`IS_TESTING: ${isTesting().toString()}`);

const app = getApps().length === 0 ? initializeApp() : getApps()[0];

export const fApp = app;