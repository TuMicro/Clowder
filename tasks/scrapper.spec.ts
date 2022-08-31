import assert from "assert";
import { storeOrbimarketCollection } from "../src/firestore-utils/orbimarket";
import { OrbiMarketCollection } from "../src/model/firestore/orbimarket";

const enabled = true;

if (enabled) {
  describe("scrapperOrbimarket: firebase functions", () => {
    it("Must store or update orbimarket collection on Firestore and get it", async () => {                
      
      const collection =  {...dummyCollection};  
      const r = await storeOrbimarketCollection(dummyCollection.contract,dummyCollection);

      //const r = await getRallyEvent01(docId);
      assert(r != null);
      //assert(r.start_time === test_rally_event_01.start_time);      
      console.log(r);

    }).timeout(5 * 60 * 1000);
  });
}

const dummyCollection:OrbiMarketCollection = {
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
