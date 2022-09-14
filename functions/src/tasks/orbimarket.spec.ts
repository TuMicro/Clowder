import assert from "assert";
import { OrbiMarketCollection } from "../model/firestore/orbimarket";
import { getCollectionDataForClowder, getTxnData } from "./orbimarket";


const enabled = true;

if (enabled) {
  describe("testOrbimarket: oribimarket functions", () => {

    it("test getCollectionDataForClowder invalid URL", async () => {

      const urlColl = "IVALID_URL";
      const orbiCollectionData = await getCollectionDataForClowder(urlColl, 5);
      console.log(orbiCollectionData);
      assert(orbiCollectionData == null);
      
    }).timeout(5 * 60 * 1000);

    it("test getCollectionDataForClowder valid URL", async () => {

      const urlColl = "https://www.orbitmarket.io/nft/0xb19da44293147ad2dd0ea3ded47949d2971a3818/155";
      const orbiCollectionData = await getCollectionDataForClowder(urlColl, 5);
      console.log(orbiCollectionData);
      assert(orbiCollectionData != null);
      
    }).timeout(5 * 60 * 1000);

    it("test txnData", async () => {

      const orbiNtf = "0xabbaa322a763b36587e3f63e46a81deacb2957a7";
      const orbiCollectionData = await getTxnData(orbiNtf);
      console.log(orbiCollectionData);
    }).timeout(5 * 60 * 1000);

  });
}

const dummyCollection: OrbiMarketCollection = {
  name: "test name",
  contract: "test contract",
  description: "test description",
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
  timestamp: null,
};
