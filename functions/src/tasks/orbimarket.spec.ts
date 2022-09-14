import assert from "assert";
import { OrbiMarketCollection } from "../model/firestore/orbimarket";
import { getCollectionDataForClowder, getTxnData } from "./orbimarket";


const enabled = true;

if (enabled) {
  describe("testOrbimarket: oribimarket functions", () => {

    it("test getCollectionDataForClowder", async () => {

      const urlColl = "https://www.orbitmarket.io/nft/0xabbaa322a763b36587e3f63e46a81deacb2957a7/14404840189847758859272355737320615932652549548219367136158005517076650715578";
      const orbiCollectionData = await getCollectionDataForClowder(urlColl, 5);
      console.log(orbiCollectionData);
    }).timeout(5 * 60 * 1000);

    it.only("test txnData", async () => {

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
