import { BigNumber, BigNumberish, TypedDataDomain, Wallet } from "ethers";
import { ethers, network } from "hardhat";
import { ETHER, MAX_UINT256 } from "../constants/ether";
import { getUnixTimestamp, ONE_DAY_IN_SECONDS, ONE_HOUR_IN_SECONDS } from "../constants/time";
import { ClowderSignature } from "./clowdersignature";
import { DeployOutputs, deployForTests } from "./deployclowdermain";
import { AssetType, BuyOrderV1, BuyOrderV1Basic, TransferOrderV1, TransferOrderV1Basic } from "./model";
import { getBuyExecutionPriceFromPrice } from "./utils";
import { ERC721, ERC721__factory, Erc1155_example2__factory, TraderClowderDelegateV1, TraderClowderDelegateV1__factory } from "../../typechain-types";
import { ZERO_ADDRESS } from "../../src/constants/zero";
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
      owner, delegateFactory } = deployOutputs;


    const nonce = await ethers.provider.getTransactionCount(delegateFactory);
    const traderDelegateAddress = ethers.utils.getContractAddress({
      from: delegateFactory,
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

      delegate: ZERO_ADDRESS, // TODO: change when we move to delegate factory recognition
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

            assetType: AssetType.ERC20, //TODO: test with WETH 
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

  it("test transferAsset with weth", async () => {
    const { thirdParty,
      wethTokenContract, wethHolder,
      owner: owner2 } = deployOutputs;

    const wethTransfered = ETHER.mul(2);
    await wethTokenContract.connect(wethHolder).transfer(traderClowderDelegateV1.address, wethTransfered);
    const initialWethHolderBalance = await wethTokenContract.balanceOf(wethHolder.address);
    const initialDelegateBalance = await wethTokenContract.balanceOf(traderClowderDelegateV1.address);
    console.log("initialWethHolderBalance", formatEther(initialWethHolderBalance));
    console.log("initialDelegateBalance", formatEther(initialDelegateBalance));

    const transferOrder: TransferOrderV1Basic = {
      signer: thirdParty.address,
      assetType: AssetType.ERC20,
      token: wethTokenContract.address,
      tokenId: BigNumber.from(erc721TokenId), //se le puede dar cualquier cosa
      recipient: wethHolder.address,
      nonce: BigNumber.from(0),
    };

    const transferOrderSigned = await TraderClowderDelegateSignature.signTransferOrder(
      transferOrder,
      traderDomain,
      thirdParty,
    );

    await traderClowderDelegateV1.connect(wethHolder).transferAsset(
      [transferOrderSigned]
    );

    const finalWethHolderBalance = await wethTokenContract.balanceOf(wethHolder.address);
    const finalDelegateBalance = await wethTokenContract.balanceOf(traderClowderDelegateV1.address);
    console.log("finalWethHolderBalance", formatEther(finalWethHolderBalance));
    console.log("finalDelegateBalance", formatEther(finalDelegateBalance));

    expect(initialWethHolderBalance.add(initialDelegateBalance)).to.be.equal(finalWethHolderBalance);
    expect(finalDelegateBalance).to.be.equal(BigNumber.from(0));

  });

  it("test transferAsset with ERC1155", async () => {
    const { thirdParty,
      wethTokenContract, wethHolder,
      owner: owner2 } = deployOutputs;

    // // sendTransaction don't work with this collection, balanceOf don't work either. 
    // This happens because the contract did not exist in the block number we forked (43843580)
    // //"NFTouring" collection, "Typical Bundle" NFT (ERC1155) : https://opensea.io/assets/matic/0x32f49945225477f16204329bb926577c56878a2f/1736
    // const erc1155Contract = Erc1155_example__factory.connect("0x32f49945225477f16204329bB926577c56878a2f",
    //   ethers.provider);
    // const erc1155Holder = await impersonateAccount("0xAa6CeD3B3360524330E1088B26FA7e6d3eC2a631");
    // const tokenId = BigNumber.from(1736);


    // "CyberKongz: Play & Kollect" collection, "Cyber Fragment" NFT (ERC1155) : https://opensea.io/assets/matic/0x7cbccc4a1576d7a05eb6f6286206596bcbee14ac/1
    const erc1155Contract = Erc1155_example2__factory.connect("0x7cBCCC4a1576d7A05eB6f6286206596BCBee14aC",
      ethers.provider);
    //const erc1155Holder = await impersonateAccount("0xaB8Eee3493a55a7bd8126865fD662B7097928088"); //sendTransaction doesn't work with this account because its a contract
    const erc1155Holder = await impersonateAccount("0x7B3B3097699794d2a4e6D73479980EEdB21E32a3");
    const tokenId = BigNumber.from(1);

    const holderPreInitialBalance = await erc1155Contract.balanceOf(erc1155Holder.address, tokenId);
    console.log("holderPreInitialBalance:", holderPreInitialBalance);
    const delegatePreInitialBalance = await erc1155Contract.balanceOf(traderClowderDelegateV1.address, tokenId);
    console.log("delegatePreInitialBalance:", delegatePreInitialBalance);

    // erc1155Holder could don't have enough funds, try to send some eth to it    
    await wethHolder.sendTransaction({
      to: erc1155Holder.address,
      value: ethers.utils.parseEther("1"),
      gasLimit: 30_000_000 - 1,
    });

    // transfer the NFT from erc1155Holder to traderClowderDelegateV1
    await erc1155Contract.connect(erc1155Holder).safeTransferFrom(
      erc1155Holder.address, // la wallet impersonada, la misma que se pone en connect
      traderClowderDelegateV1.address, // traderClowderDelegateV1
      tokenId, // token id
      1, //amount, // poner 1
      [], //poner un arreglo vacío  ocadena vacía
    );

    const holderInitialBalance = await erc1155Contract.balanceOf(erc1155Holder.address, tokenId);
    console.log("holderFinalBalance:", holderInitialBalance);
    const delegateInitialBalance = await erc1155Contract.balanceOf(traderClowderDelegateV1.address, tokenId);
    console.log("delegateFinalBalance:", delegateInitialBalance);

    const transferOrder: TransferOrderV1Basic = {
      signer: thirdParty.address,
      assetType: AssetType.ERC1155,
      token: erc1155Contract.address,
      tokenId: tokenId,
      recipient: erc1155Holder.address,
      nonce: BigNumber.from(0),
    };

    const transferOrderSigned = await TraderClowderDelegateSignature.signTransferOrder(
      transferOrder,
      traderDomain,
      thirdParty,
    );

    await traderClowderDelegateV1.connect(wethHolder).transferAsset(
      [transferOrderSigned]
    );

    const holderFinalBalance = await erc1155Contract.balanceOf(erc1155Holder.address, tokenId);
    console.log("holderFinalBalance:", holderFinalBalance);
    const delegateFinalBalance = await erc1155Contract.balanceOf(traderClowderDelegateV1.address, tokenId);
    console.log("delegateFinalBalance:", delegateFinalBalance);


    expect(holderInitialBalance.add(delegateInitialBalance)).to.be.equal(holderFinalBalance);
    expect(delegateFinalBalance).to.be.equal(BigNumber.from(0));
  });

  it("test transferAsset with native ETH", async () => {
    const { thirdParty,
      wethTokenContract, wethHolder,
      owner: owner2 } = deployOutputs;

    // Test all above with native eth token
    // todas las cuentas tienen token nativo, tendríamos que transferirle un poco al delegado
    // potencial problema: todos los connects y sendTransaction, le gastan un poco de eth a quien los ejecuta

    await thirdParty.sendTransaction({
      to: traderClowderDelegateV1.address,
      value: ethers.utils.parseEther("1"),
    });

    //check balances
    const initialHolderBalance = await ethers.provider.getBalance(wethHolder.address);
    console.log("initialHolderBalance:", formatEther(initialHolderBalance));
    const initialDelegateBalance = await ethers.provider.getBalance(traderClowderDelegateV1.address);
    console.log("initialDelegateBalance:", formatEther(initialDelegateBalance));


    const transferOrder: TransferOrderV1Basic = {
      signer: thirdParty.address,
      assetType: AssetType.NATIVE,
      token: ZERO_ADDRESS,
      tokenId: BigNumber.from(0),
      recipient: wethHolder.address,
      nonce: BigNumber.from(0),
    };

    const transferOrderSigned = await TraderClowderDelegateSignature.signTransferOrder(
      transferOrder,
      traderDomain,
      thirdParty,
    );

    await traderClowderDelegateV1.connect(thirdParty).transferAsset(
      [transferOrderSigned]
    );

    //check balances
    const finalHolderBalance = await ethers.provider.getBalance(wethHolder.address);
    console.log("finalHolderBalance:", formatEther(finalHolderBalance));
    const finalDelegateBalance = await ethers.provider.getBalance(traderClowderDelegateV1.address);
    console.log("finalHolderBalance:", formatEther(finalDelegateBalance));

    expect(initialHolderBalance.add(initialDelegateBalance)).to.be.equal(finalHolderBalance);
    expect(finalDelegateBalance).to.be.equal(BigNumber.from(0));

  });
});
