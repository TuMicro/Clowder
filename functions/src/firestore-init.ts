import { fApp } from "./firebase-init"; // required 
import { getFirestore } from 'firebase-admin/firestore';

export const fdb = getFirestore(fApp);
