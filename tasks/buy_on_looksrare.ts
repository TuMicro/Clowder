import { BigNumber, Wallet } from "ethers";
import { task } from "hardhat/config";
import { MAX_UINT256 } from "../test/constants/ether";
import { LooksRareExchange__factory, Weth9__factory } from "../typechain-types";
import { formatEther } from "ethers/lib/utils";
import { addressesByNetwork, encodeOrderParams, MakerOrder, MakerOrderWithVRS, SupportedChainId, TakerOrder } from "@looksrare/sdk";
import { WETH_ADDRESS } from "../test/ClowderMain/addresses";


task("buy_on_looksrare", ""
  + "Make sure the accounts have enough ETH and the parameters are correct.")
  .setAction(async (taskArgs, hre) => {
    const { ethers, getChainId } = hre;
    const chainId = Number(await getChainId());

    /* Parameters */
    // const makerOrder: MakerOrder & { signature: string } = { "isOrderAsk": true, "signer": "0x85a49C39d3A9cfd4c2459EFA8eCe5389277E304c", "collection": "0x0381916e8172d96cdDC682490B522E4f539f85D6", "price": "0x01ad1f17947239313e", "tokenId": "0x1c21", "amount": "0x01", "strategy": "0x732319A3590E4fA838C111826f9584a9A2fDEa1a", "currency": "0xc778417E063141139Fce010982780140Aa0cD5Ab", "nonce": "0x00", "startTime": "0x6298f1a8", "endTime": "0x629a4318", "minPercentageToAsk": "0x2648", "params": [], "signature": "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000011b" };
    const makerOrder: MakerOrder & { signature: string } = {"isOrderAsk":true,"signer":"0x0012292bCfbD99fde00faE872668379E5F0090C5","collection":"0x0381916e8172d96cdDC682490B522E4f539f85D6","price":"0x249e4d1b00df57","tokenId":"0x09bb","amount":"0x01","strategy":"0x732319A3590E4fA838C111826f9584a9A2fDEa1a","currency":"0xc778417E063141139Fce010982780140Aa0cD5Ab","nonce":"0x00","startTime":"0x62990e80","endTime":"0x629a5ff0","minPercentageToAsk":"0x2648","params":[],"signature":"0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000011b"};
    const buyer = new Wallet(process.env.PK_ERC721_HOLDER ?? "", ethers.provider);

    /* Execution */

    // getting contracts ready
    if (!Object.values(SupportedChainId).includes(chainId)) {
      throw new Error(`Unsupported chainId: ${chainId}`);
    }
    const addresses = addressesByNetwork[chainId as SupportedChainId];
    const wethTokenContract = Weth9__factory.connect(WETH_ADDRESS[chainId], ethers.provider);
    const looksrareExchangeContract = LooksRareExchange__factory.connect(addresses.EXCHANGE, ethers.provider);


    // getting the WETH
    const listingPrice = BigNumber.from(makerOrder.price);
    console.log(`Listing price: ${formatEther(listingPrice)}`);
    const wethBalance = await wethTokenContract.balanceOf(buyer.address);
    if (wethBalance.lt(listingPrice)) {
      await wethTokenContract.connect(buyer).deposit({
        value: listingPrice,
      });
    }

    // approve the marketplace contract to spend the buyer's WETH
    if ((await wethTokenContract.allowance(buyer.address,
      addresses.EXCHANGE)).lt(listingPrice)) {
      await wethTokenContract.connect(buyer).approve(
        addresses.EXCHANGE,
        MAX_UINT256
      );
    }

    // formatting the maker order
    const { encodedParams } = encodeOrderParams(makerOrder.params);
    const vrs = ethers.utils.splitSignature(makerOrder.signature);

    const askWithoutHash: MakerOrderWithVRS = {
      ...makerOrder,
      ...vrs,
      params: encodedParams,
    };

    const order: TakerOrder = {
      isOrderAsk: false,
      taker: buyer.address,
      price: makerOrder.price,
      tokenId: makerOrder.tokenId,
      minPercentageToAsk: makerOrder.minPercentageToAsk,
      params: encodedParams as any,
    };

    await looksrareExchangeContract.connect(buyer).matchAskWithTakerBid(order, askWithoutHash);


    console.log("Buy successful! 👌");
  });

