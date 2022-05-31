const Web3 = require("web3");
import { BigNumber } from 'ethers';
import { OpenSeaPort, Network } from 'opensea-js';
import { getChainRpcUrl } from '../../hardhat.config';
import { ETHER, MAX_UINT256 } from '../constants/ether';
import { OpenSeaConstants } from '../constants/opensea';
import { getUnixTimestamp, ONE_DAY_IN_SECONDS } from '../constants/time';
import { OpenSeaSignature } from '../opensea/OpenSeaSignature';
import { WETH_ADDRESS_MAINNET, WETH_ADDRESS_RINKEBY } from './addresses';
import { ClowderSignature } from './clowdersignature';
import { deployForTests, DeployOutputs } from './deploy';
import { BuyOrderV1 } from './model';
import { getBuyExecutionPriceFromPrice, getSellExecutionPriceFromPrice } from './utils';

describe("Listing on OpenSea", () => {

  let deployOutputs: DeployOutputs;
  let buyOrderSigned: BuyOrderV1;

  // execution parameters that should be accepted
  const executionId = BigNumber.from(0);

  beforeEach(async () => {
    deployOutputs = await deployForTests();
    const { clowderMain, thirdParty, eip712Domain, feeFraction,
      testERC721, testERC721Holder, wethTokenContract, wethHolder,
      owner, testERC721TokenId } = deployOutputs;

    const contribution = ETHER.mul(10);

    // getting the WETH
    await wethTokenContract.connect(thirdParty).deposit({
      value: contribution
    });

    const buyPrice = ETHER.mul(40);
    const buyOrder = {
      signer: thirdParty.address,
      collection: testERC721.address,
      executionId,
      contribution,

      buyPrice,
      buyNonce: BigNumber.from(0),
      buyPriceEndTime: getUnixTimestamp().add(ONE_DAY_IN_SECONDS),

      sellPrice: ETHER.mul(30),
      sellPriceEndTime: getUnixTimestamp().add(ONE_DAY_IN_SECONDS),
      sellNonce: BigNumber.from(0),
    };
    buyOrderSigned = await ClowderSignature.signBuyOrder(buyOrder,
      eip712Domain,
      thirdParty
    );

    // approve the clowder contract to spend thirdParty's WETH (contribution)
    await wethTokenContract.connect(thirdParty).approve(
      clowderMain.address,
      MAX_UINT256
    );

    // approve the clowder contract to move nft holder's nfts
    await testERC721.connect(testERC721Holder).setApprovalForAll(
      clowderMain.address,
      true,
    );
    const executionPrice = getBuyExecutionPriceFromPrice(contribution, feeFraction);
    await clowderMain.connect(testERC721Holder).executeOnPassiveBuyOrders(
      [buyOrderSigned],
      executionPrice,
      testERC721TokenId
    );
  });

  const enableSellOrderExamplesObtention = false;
  if (enableSellOrderExamplesObtention) {
    it("Getting sell order examples", async () => {
      // network dependant configuration:
      const isMainnet = false; // if true API_KEY is required
      const YOUR_API_KEY = ""; // not required for rinkeby
      const provider = new Web3.providers.HttpProvider(getChainRpcUrl(isMainnet ? "mainnet" : "rinkeby"));
      const networkName = isMainnet ? Network.Main : Network.Rinkeby;
      const apiBaseUrl = isMainnet ? OpenSeaConstants.API_BASE_MAINNET : OpenSeaConstants.API_BASE_RINKEBY;
      const paymentTokenAddress = isMainnet ? WETH_ADDRESS_MAINNET : WETH_ADDRESS_RINKEBY;


      const seaport = new OpenSeaPort(provider, {
        networkName,
        apiKey: YOUR_API_KEY,
        apiBaseUrl,
      });

      const testNfts = isMainnet ? [
        {
          tokenAddress: "0x60e4d786628fea6478f785a6d7e704777c86a7c6",
          tokenId: "17924",
          owner: "0xe4F29109Df1b22D6804e4e55Ab068166b2310A6c",
        }
      ] : [ // all of them are ERC721
        {
          tokenAddress: "0xc7ab9307ce584fd06bb5011c75ccc1cb93d9aa5c",
          tokenId: "2",
          owner: "0x1108f964b384f1dCDa03658B24310ccBc48E226F",
        },
        {
          tokenAddress: "0xf5de760f2e916647fd766b4ad9e85ff943ce3a2b",
          tokenId: "781448",
          owner: "0xC7121a26D5891Ed22D0bCb11d55D2E6950Fd0EFC",
        },
        {// mine, not recognized by opensea
          tokenAddress: "0xf5de760f2e916647fd766b4ad9e85ff943ce3a2b",
          tokenId: "831349",
          owner: "0xDDc40255d888Df0d43C2ebc7a809F9221B493339",
        }
      ];

      const { tokenAddress, tokenId, owner: accountAddress } = testNfts[1];


      const sellOrder = await OpenSeaSignature.justCreateSellOrder(seaport, {
        asset: {
          tokenId,
          tokenAddress,
        },
        accountAddress,
        startAmount: 1,
        paymentTokenAddress, // required when using WETH or other ERC20
        expirationTime: getUnixTimestamp().toNumber() + ONE_DAY_IN_SECONDS,
      });
      console.log(sellOrder);
      console.log(JSON.stringify(sellOrder));
    });
  }
  it("Should be able to list through the contract", async () => {
    const { clowderMain, thirdParty, eip712Domain, feeFraction,
      testERC721, testERC721Holder, wethTokenContract, wethHolder,
      owner, testERC721TokenId } = deployOutputs;

    const protocolSellingFeeFraction = BigNumber.from(10); // out of 10_000
    await clowderMain.connect(owner).changeProtocolFeeFractionFromSelling(protocolSellingFeeFraction);
    const executionPrice = getSellExecutionPriceFromPrice(buyOrderSigned.sellPrice, protocolSellingFeeFraction);
    const marketplaceFees = BigNumber.from(250);
    await clowderMain.listOnOpenSea([buyOrderSigned], executionPrice, marketplaceFees);
  });
});
