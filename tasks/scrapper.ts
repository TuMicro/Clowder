import { task } from "hardhat/config";
import fetch from "node-fetch";
import { TextDecoder } from "util";
import { storeOrbimarketNFT, getOrbimarketCollection, storeOrbimarketCollection, addDataToOrbimarketCollection } from "../src/firestore-utils/orbimarket";
import { OrbiMarketCollection, OrbiMarketNFT } from "../src/model/firestore/orbimarket";

console.log("");
// print current date and time
console.log("Current date and time: " + new Date().toLocaleString());
console.log("");

const dummyCollection: OrbiMarketCollection = {
  name: "test name",
  contract: "test-contract",
  description: "test description 2",
  bannerURL: "https://www.orbitmarket.io/static/media/apes-banner.2b2b2b8e.png",
  imageURL: "https://www.orbitmarket.io/static/media/apes-logo.2b2b2b8e.png",
  category: ["NFT"],
  socials: [
    {
      type: "twitter",
      value: "https://twitter.com/OrbitMarket"
    },
    {
      type: "discord",
      value: "https://discord.gg/8Z8Y4Z2"
    },
    {
      type: "telegram",
      value: "https://t.me/OrbitMarket"
    },
    {
      type: "website",
      value: "https://www.orbitmarket.io/"
    }
  ],
  timestamp: new Date().getTime(),
};


async function getFloorPrice(collectionId: string) {
  const numberOfItems = 1
  //Obj of data to send in future like a dummyDb
  const body = {
    operationName: "floor",
    variables: {
      listingFilter: {
        active: true,
        nftAddress: collectionId,
        payToken_in: [
          "0x0000000000000000000000000000000000000000",
          "0xd4949664cd82660aae99bedc034a0dea8a0bd517"
        ]
      }
    },
    query: "query floor($listingFilter: Listing_filter) {\n  listings(\n    first: " + numberOfItems + "\n    orderBy: pricePerItem\n    orderDirection: asc\n    where: $listingFilter\n  ) {\n    pricePerItem\n    nftAddress\n    __typename\n  }\n}\n"
  };

  const bodyJson = JSON.stringify(body);
  //POST request with body equal on data in JSON format
  const res = await fetch('https://api.orbitmarket.io/subgraphs/name/CryptLabsUAE/ApesMarket', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: bodyJson,
  });

  const responseData = await res.json();

  if (responseData.data != null) {
    return responseData.data.listings[0].pricePerItem;
  }

  return null;
}

async function getOrbiNfts(collectionId: string, numberOfItems: number): Promise<OrbiMarketNFT[] | null> {
  //Obj of data to send in future like a dummyDb
  const body = {
    "operationName": "userTokens",
    "variables": {
      "tokenFilter": {
        "nftAddress": collectionId,
        "listed": true
      },
      "first": numberOfItems,
      "skip": 0,
      "orderBy": "listedTime",
      "orderDirection": "desc"
    },
    "query": "query userTokens($nftAddress: String, $first: Int, $skip: Int, $tokenFilter: Token_filter, $orderBy: BigInt, $orderDirection: String) {\n  tokens(\n    first: $first\n    skip: $skip\n    where: $tokenFilter\n    orderBy: $orderBy\n    orderDirection: $orderDirection\n  ) {\n    id\n    owner\n    listed\n    tokenId\n    isERC1155\n    nftAddress\n    pricePerItem\n    listedTime\n    lastSaleTime\n    lastSalePrice\n    payToken\n    lastSalePayToken\n    name\n    auction {\n      payToken\n      currentBidder\n      endTime\n      id\n      maximumBid\n      nftAddress\n      owner\n      startTime\n      reservePrice\n      tokenId\n      __typename\n    }\n    __typename\n  }\n}\n"
  };

  const bodyJson = JSON.stringify(body);
  //POST request with body equal on data in JSON format
  const res = await fetch('https://api.orbitmarket.io/subgraphs/name/CryptLabsUAE/ApesMarket', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: bodyJson,
  });

  const responseData = await res.json();

  if (responseData.data != null && responseData.data.tokens != null) {
    return responseData.data.tokens as OrbiMarketNFT[];
  }

  return null;
}

async function getOrbiNFTExtraData(body: { address: string; token: string; type: string; }): Promise<Partial<OrbiMarketNFT> | null> {

  //GET request
  const res = await fetch('https://cache.orbitmarket.io/metadata?' + new URLSearchParams(body));

  try {
    const responseData = await res.json();
    return responseData as Partial<OrbiMarketNFT>;
  } catch (error) {
    console.log(error);
  }

  return null;
}

async function getOrbiMarketCollections() {

  const urlOrbiCollections = "https://www.orbitmarket.io/collections";
  //const urlDataJs = "https://www.orbitmarket.io/static/js/main.66f214a2.chunk.js";

  const r = await fetch(urlOrbiCollections, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const htmlStr = await r.text();
  const filterHtmlFrom = '<script src="/static/js/main';
  const filterHtmlTo = '</script>';

  const idxFromHtml = htmlStr.indexOf(filterHtmlFrom) + 13;
  const idxToHtml = htmlStr.indexOf(filterHtmlTo, idxFromHtml) - 2;

  const urlDataJs = "https://www.orbitmarket.io" + htmlStr.substring(idxFromHtml, idxToHtml);

  console.log(urlDataJs);

  const res = await fetch(urlDataJs, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const resStr = await res.text();
  const filterFrom = "var a=t(62).c?{";
  const indexFrom = resStr.indexOf(filterFrom) + filterFrom.length - 1;
  const indexTo = resStr.indexOf("}:{", indexFrom) + 1;

  const dataStr = resStr.substring(indexFrom, indexTo);
  //console.log(dataStr);
  return eval('(' + dataStr + ')');
}

async function scrappingOrbiMarketCollectionsToFirebase() {

  //const floorPrice = await getFloorPrice();
  //console.log(floorPrice);
  const collections = await getOrbiMarketCollections();
  //console.log(collections);

  //loop collections
  for (const id in collections) {
    const orbiCollection: Partial<OrbiMarketCollection> = collections[id];
    orbiCollection.timestamp = new Date().getTime();

    const orbiCollectionStored = await getOrbimarketCollection(id);

    if (orbiCollectionStored == null) {
      await storeOrbimarketCollection(id, orbiCollection);
      console.log("collection created: " + id);
    } else {
      await addDataToOrbimarketCollection(id, orbiCollection);
      console.log("collection updated: " + id);
    }
  }

  return true;
}

async function getCollectionDataForClowder(url: string, minNfts: number) {

  const indexFrom = url.indexOf("/0x") + 1;
  const collId = url.substring(indexFrom, indexFrom + 42);
  console.log("collectionId: ", collId);

  let orbiCollection = await getOrbimarketCollection(collId);
  console.log("orbiCollection name: ", orbiCollection?.name);
  if (orbiCollection == null) {
    console.log("scrapping collections...")
    await scrappingOrbiMarketCollectionsToFirebase();

    orbiCollection = await getOrbimarketCollection(collId);
    console.log("orbiCollection name: ", orbiCollection?.name);
  }

  if (orbiCollection == null) return null;

  //getting floor data
  const floorPrice = await getFloorPrice(collId);
  console.log("floorPrice: ", floorPrice);
  if (floorPrice == null) return null;

  const nftsStored = orbiCollection.nfts?.length ?? 0;
  console.log("nftsStored: ", nftsStored);

  if (nftsStored >= minNfts) return orbiCollection;

  //getting nfts data
  console.log("scrapping nfts...")
  await addDataToOrbimarketCollection(collId, {
    floorPrice: floorPrice,
  });

  //getting nfts data
  const nfts = await getOrbiNfts(collId, minNfts);
  //console.log("nfts: ", nfts);
  const nftsMergeds: Partial<OrbiMarketNFT>[] = [];

  if (nfts == null) return null;

  for (const nft of nfts) {

    const nftExtraData = await getOrbiNFTExtraData({ address: nft.nftAddress, token: nft.tokenId, type: nft.isERC1155 ? "1155" : "721" });
    //console.log("nftExtraData: ", nftExtraData);
    //merge nft and nftExtraData
    const nftMerged = { ...nft, ...nftExtraData };
    //console.log("nftMerged: ", nftMerged);

    await storeOrbimarketNFT(nftMerged.id, nftMerged);
    console.log("nft stored: " + nftMerged.id);

    nftsMergeds.push(nftMerged);
  }

  await addDataToOrbimarketCollection(collId, { nfts: nftsMergeds });

  return { ...orbiCollection, nfts: nftsMergeds, floorPrice: floorPrice };
}

//const success = scrappingOrbiMarketCollectionsToFirebase();
const urlColl = "https://www.orbitmarket.io/collection/0xedf6e953f0ecfc10aee6d3a8508b5fbe14b94a2c";
const orbiCollectionData = getCollectionDataForClowder(urlColl, 5).then((data) => {
  console.log("collectionData:", data);
});

