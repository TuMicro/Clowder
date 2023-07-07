import { BigNumber, BigNumberish, TypedDataDomain, Wallet } from "ethers";
import { ethers, network } from "hardhat";
import { ETHER, MAX_UINT256 } from "../constants/ether";
import { getUnixTimestamp, ONE_DAY_IN_SECONDS, ONE_HOUR_IN_SECONDS } from "../constants/time";
import { ClowderSignature } from "./clowdersignature";
import { DeployOutputs, deployForTests } from "./deployclowdermain";
import { AssetType, BuyOrderV1, BuyOrderV1Basic, SellOrderV1Basic, TransferOrderV1, TransferOrderV1Basic } from "./model";
import { getBuyExecutionPriceFromPrice } from "./utils";
import { ERC721, ERC721__factory, SeaportInterface__factory, TraderClowderDelegateV1, TraderClowderDelegateV1__factory, XSplitMain__factory } from "../../typechain-types";
import { OpenSeaSeaportConstants } from "../constants/seaport";
import { ZERO_ADDRESS, ZERO_BYTES32 } from "../../src/constants/zero";
import { ReservoirOracleFloorAsk, fetchOracleFloorAsk } from "../../src/api/reservoir-oracle-floor-ask";
import { TraderClowderDelegateSignature } from "./delegatesignature";
import { getChainRpcUrl } from "../../hardhat.config";
import { impersonateAccount } from "../hardhat-util";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { formatEther } from "ethers/lib/utils";

describe("Delegate transferAsset", () => {

  let deployOutputs: DeployOutputs;
  let buyOrderSigned: BuyOrderV1;
  let traderClowderDelegateV1: TraderClowderDelegateV1;
  let erc721Contract: ERC721;
  let nftOwner: SignerWithAddress;
  let erc721TokenId: BigNumberish;
  let traderDomain: TypedDataDomain;
  let chainId: number;

  // execution parameters that should be accepted
  const executionId = BigNumber.from(12);

  beforeEach(async () => {

    // get hre and change network to mainnet
    await network.provider.request({
      method: "hardhat_reset",
      params: [{
        forking: {
          jsonRpcUrl: getChainRpcUrl("polygon-mainnet"),
          blockNumber: 43843572,
        },
        // chainId: 137, // this doesn't work
      }],
    });

    // NOTE: no matter what jsonRpcUrl you set above
    // the chainId is still the same as set in the hardhat.config.js file

    const nn = await ethers.provider.getNetwork();
    if (nn.chainId !== 137) {
      throw new Error("Wrong network, make sure to fork polygon mainnet in the hardhat.config.js file also");
    }
    chainId = nn.chainId;

    deployOutputs = await deployForTests();
    const { clowderMain, thirdParty, eip712Domain, feeFraction,
      wethTokenContract, wethHolder,
      owner } = deployOutputs;

    // traderClowderDelegateV1 = await deployDelegate(
    //   clowderMain.address,
    //   executionId,
    //   "0xAeB1D03929bF87F69888f381e73FBf75753d75AF" // reservoir oracle signer address
    // );
    const nonce = await ethers.provider.getTransactionCount(clowderMain.address);
    const traderDelegateAddress = ethers.utils.getContractAddress({
      from: clowderMain.address,
      nonce: nonce,
    });
    traderClowderDelegateV1 = TraderClowderDelegateV1__factory.connect(traderDelegateAddress,
      ethers.provider);

    nftOwner = await impersonateAccount("0x45A2235b9027eaB23FfcF759c893763F0019cBff");
    erc721Contract = ERC721__factory.connect("0x220fa5ccc9404802ed6db0935eb4feefc27c937e",
      ethers.provider);
    erc721TokenId = BigNumber.from(4131);

    // print the current block number
    console.log(`Current block number: ${await ethers.provider.getBlockNumber()}`);

    const contribution = ETHER.mul(10);

    // getting the WETH
    await wethTokenContract.connect(thirdParty).deposit({
      value: contribution
    });

    const buyPrice = ETHER.mul(40);
    const buyOrder: BuyOrderV1Basic = {
      signer: thirdParty.address,
      collection: erc721Contract.address,
      executionId,
      contribution,

      buyPrice,
      buyNonce: BigNumber.from(0),
      buyPriceEndTime: getUnixTimestamp().add(ONE_DAY_IN_SECONDS),

      delegate: ZERO_ADDRESS, // TODO: change when we move to minimal proxy
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
    await erc721Contract.connect(nftOwner).setApprovalForAll(
      clowderMain.address,
      true,
    );
    const executionPrice = getBuyExecutionPriceFromPrice(contribution, feeFraction);
    await clowderMain.connect(nftOwner).executeOnPassiveBuyOrders(
      [buyOrderSigned,], // should be all buy orders
      executionPrice,
      erc721TokenId,
      [],
    );

    traderDomain = TraderClowderDelegateSignature.getDomain(chainId, traderClowderDelegateV1.address);
  });

  it("test transfer asset with 2 holders", async () => {
    const { thirdParty,
      wethTokenContract, wethHolder,
      owner: owner2 } = deployOutputs;

    const initialSharesOfThirdParty = await traderClowderDelegateV1.balanceOf(thirdParty.address);

    // now thirdParty transfers ~x% of the shares to owner2
    await traderClowderDelegateV1.connect(thirdParty).transfer(owner2.address, initialSharesOfThirdParty.mul(2).div(3));
    const newSharesOfThirdParty = await traderClowderDelegateV1.balanceOf(thirdParty.address);
    console.log("newSharesOfThirdParty", newSharesOfThirdParty);

    const newSharesOwner2 = await traderClowderDelegateV1.balanceOf(owner2.address);
    console.log("newSharesOwner2", newSharesOwner2);

    // thirdParty no debería poder transferir
    const transferOrder2: TransferOrderV1Basic = {
      signer: thirdParty.address,

      assetType: AssetType.ERC721,
      token: erc721Contract.address,
      tokenId: BigNumber.from(erc721TokenId),
      recipient: wethHolder.address,
      nonce: BigNumber.from(0),
    };

    const transferOrderSigned2 = await TraderClowderDelegateSignature.signTransferOrder(transferOrder2,
      traderDomain,
      thirdParty,
    );
    await expect(traderClowderDelegateV1.connect(thirdParty).transferAsset(
      [transferOrderSigned2]
    )).to.be.revertedWith("Transfer: consensus not reached");

    // ambos owners juntos deberían poder transferir
    const transferOrder3: TransferOrderV1Basic = {
      signer: owner2.address,

      assetType: AssetType.ERC721,
      token: erc721Contract.address,
      tokenId: BigNumber.from(erc721TokenId),
      recipient: wethHolder.address,
      nonce: BigNumber.from(0),
    };

    const transferOrderSigned3 = await TraderClowderDelegateSignature.signTransferOrder(
      transferOrder3,
      traderDomain,
      owner2,
    );

    await expect(traderClowderDelegateV1.connect(wethHolder).transferAsset(
      [transferOrderSigned3, transferOrderSigned3]
    )).to.be.revertedWith("Signer already voted");

    await traderClowderDelegateV1.connect(wethHolder).transferAsset(
      [transferOrderSigned2, transferOrderSigned3]
    );

    // make sure wethHolder has the nft now
    expect(await erc721Contract.ownerOf(erc721TokenId)).to.be.equal(wethHolder.address);

  });

  const itEnabled = false;
  if (itEnabled) {

    //create arr of numbers and fill it with 1 to 20
    //const arr = Array.from(Array(20).keys()).map(x => x + 1);
    //arr.push(50, 100, 150, 200, 250, 300, 350, 400);

    const arr = [320];

    //get the max number in the array
    const max = Math.max(...arr);
    const wallets = Array.from(Array(max).keys()).map(x => {
      return ethers.Wallet.createRandom().connect(ethers.provider);
    });

    for (const n_signers of arr) {
      it.only("test transferAsset gas with " + n_signers + " buyers", async () => {
        const { thirdParty,
          wethTokenContract, wethHolder,
          owner: owner2 } = deployOutputs;

        const signedTransferOrders: TransferOrderV1[] = [];

        for (let i_signer = 1; i_signer <= n_signers; i_signer++) {
          let signer: SignerWithAddress | Wallet;
          if (i_signer === 1) {
            signer = thirdParty;
          } else {
            signer = wallets[i_signer - 2];
            await traderClowderDelegateV1.connect(thirdParty).transfer(signer.address, BigNumber.from(1));
          }

          const transferOrder: TransferOrderV1Basic = {
            signer: signer.address,

            assetType: AssetType.ERC721,
            token: erc721Contract.address,
            tokenId: BigNumber.from(erc721TokenId),
            recipient: wethHolder.address,
            nonce: BigNumber.from(0),
          };

          const transferOrderSigned = await TraderClowderDelegateSignature.signTransferOrder(transferOrder,
            traderDomain,
            signer,
          );

          signedTransferOrders.push(transferOrderSigned);
        }

        const txn = await traderClowderDelegateV1.connect(wethHolder).transferAsset(signedTransferOrders, {
          gasLimit: 30_000_000 - 1,
        });

        const transferReceipt = await txn.wait();

        console.log("n_signers:", signedTransferOrders.length + ", gasUsed:", transferReceipt.gasUsed.toString());

      }).timeout(ONE_HOUR_IN_SECONDS * 1000);
    }


  }
});
