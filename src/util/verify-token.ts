import { fApp } from "../firebase-init";
import { getAuth } from 'firebase-admin/auth';
import { isTesting } from "./devEnv";

// idToken comes from the client app
export async function verifyIdToken(idToken: string): Promise<string | null> {
  try {
    if (isTesting()) return idToken;
    const decodedToken = await getAuth(fApp).verifyIdToken(idToken);
    return decodedToken.uid;
  } catch (e) {
    console.log("[ERROR] Token verification failed", e);
    // console.log(e); // uncommented to prevent triggering log alarms
    return null;
  }
}
