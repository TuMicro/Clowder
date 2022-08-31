import { OrbiMarketCollection, OrbiMarketNFT } from "../model/firestore/orbimarket";
import { fdb } from "../firestore-init";
import { FS_orbimarket_collections, FS_orbimarket_nfts } from "../constants/firestore";

export async function storeOrbimarketCollection(id: string, collection: Partial<OrbiMarketCollection>) {

  //set collection to firestore
  await fdb.collection(FS_orbimarket_collections).doc(id).set(collection);
}

export async function addDataToOrbimarketCollection(id: string, data: Partial<OrbiMarketCollection>) {
  //set collection to firestore
  await fdb.collection(FS_orbimarket_collections).doc(id).update(data);
}

export async function getOrbimarketCollection(id: string) {

  const s = await fdb.collection(FS_orbimarket_collections).doc(id).get();
  const r = s.data() as OrbiMarketCollection | undefined; // undefined when doc not found
  if (r != null) {
    return {
      id: id,
      ...r,
    };
  }
  return r;
}


export async function storeOrbimarketNFT(id: string, nft: Partial<OrbiMarketNFT>) {
  await fdb.collection(FS_orbimarket_nfts).doc(id).set(nft);  
}