export interface Execution { // both in unix seconds
  collectionAddress: string,
  collectionCreator: ExecutionCreator,
  executionId: string,
  transactionId: string | null,
}

export interface ExecutionCreator { // both in unix seconds
  email: string,
  wallet: string,
}

