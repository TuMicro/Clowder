import { FS_executions, FS_orbimarket_collections } from "../constants/firestore";
import { fdb } from "../firestore-init";
import { Execution } from "../model/firestore/clowder";

export async function storeExecution(execution: Partial<Execution>) {

  //generating id
  const newCityRef = await fdb.collection(FS_executions).doc();
  execution.executionId = newCityRef.id;
  //store execution
  const res = await newCityRef.set(execution);
  return res;
}