import { BigNumber, Contract, Wallet } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { task } from "hardhat/config";
import { WETH_ADDRESS } from "../test/ClowderMain/addresses";
import { ClowderSignature } from "../test/ClowderMain/clowdersignature";
import { getBuyExecutionPriceFromPrice } from "../test/ClowderMain/utils";
import { ETHER, MAX_UINT256 } from "../test/constants/ether";
import { getUnixTimestamp, ONE_DAY_IN_SECONDS } from "../test/constants/time";
import { ClowderMain__factory, TestERC721__factory, Weth9__factory } from "../typechain-types";

task("execute_buy", "Gets WETH, performs approvals and then performs a buy. "
  + "Make sure the accounts have enough ETH and the parameters are correct.")
  // .addParam("account", "The buyer's address")
  .setAction(async (taskArgs, hre) => {
    const { ethers, deployments, getNamedAccounts, getChainId } = hre;
    const chainId = Number(await getChainId());
    const { deployer } = await getNamedAccounts();
    const clowderDeployment = await deployments.get("ClowderMain");

    /* Parameters */

    // this ERC721 collection should be imported into OpenSea
    const collectionAddress = "0x0381916e8172d96cddc682490b522e4f539f85d6";
    const userWallet = new Wallet(process.env.PK_USER ?? "", ethers.provider);

    const testERC721Holder = new Wallet(process.env.PK_ERC721_HOLDER ?? "", ethers.provider);
    const executionId = BigNumber.from(0);
    const testERC721TokenId = BigNumber.from(2491);
    const contribution = parseEther("0.01");

    const delegate = userWallet.address;

    /* Preparation */

    const thirdParty = userWallet;

    // getting contracts ready
    const wethTokenContract = Weth9__factory.connect(WETH_ADDRESS[chainId], ethers.provider);
    const testERC721 = TestERC721__factory.connect(collectionAddress, ethers.provider);
    const clowderMain = ClowderMain__factory.connect(clowderDeployment.address, ethers.provider);

    // getting the WETH
    const wethBalance = await wethTokenContract.balanceOf(thirdParty.address);
    if (wethBalance.lt(contribution)) {
      await wethTokenContract.connect(thirdParty).deposit({
        value: contribution
      });
    }

    const buyPrice = ETHER.mul(40);
    const buyOrder = {
      signer: thirdParty.address,
      collection: testERC721.address,
      executionId,
      contribution,

      buyPrice,
      buyNonce: BigNumber.from(0),
      buyPriceEndTime: getUnixTimestamp().add(ONE_DAY_IN_SECONDS),

      delegate,
    };
    const eip712Domain = ClowderSignature.getDomain(chainId, clowderMain.address);
    const buyOrderSigned = await ClowderSignature.signBuyOrder(buyOrder,
      eip712Domain,
      thirdParty
    );

    // approve the clowder contract to spend thirdParty's WETH (contribution)
    if ((await wethTokenContract.allowance(thirdParty.address,
      clowderMain.address)).lt(contribution)) {
      await wethTokenContract.connect(thirdParty).approve(
        clowderMain.address,
        MAX_UINT256
      );
    }

    // approve the clowder contract to move nft holder's nfts
    if (!(await testERC721.isApprovedForAll(testERC721Holder.address, clowderMain.address))) {
      await testERC721.connect(testERC721Holder).setApprovalForAll(
        clowderMain.address,
        true,
      );
    }

    /* Execution */

    const feeFraction = await clowderMain.protocolFeeFraction();
    const executionPrice = getBuyExecutionPriceFromPrice(contribution, feeFraction);
    await clowderMain.connect(testERC721Holder).executeOnPassiveBuyOrders(
      [buyOrderSigned],
      executionPrice,
      testERC721TokenId,
      [],
    );

    console.log("Buy order executed!");
  });
