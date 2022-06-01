// SPDX-License-Identifier: BUSL-1.1
pragma solidity >=0.8.4;

// _________ .__                   .___
// \_   ___ \|  |   ______  _  ____| _/___________
// /    \  \/|  |  /  _ \ \/ \/ / __ |/ __ \_  __ \
// \     \___|  |_(  <_> )     / /_/ \  ___/|  | \/
//  \______  /____/\____/ \/\_/\____ |\___  >__|
//         \/                       \/    \/

import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20, SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC721Holder} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {BuyOrderV1, BuyOrderV1Functions} from "./libraries/passiveorders/BuyOrderV1.sol";
import {Execution} from "./libraries/execution/Execution.sol";
import {SafeERC20Transfer} from "./libraries/assettransfer/SafeERC20Transfer.sol";
import {SignatureUtil} from "./libraries/SignatureUtil.sol";
import {MarketplaceSignatureUtil, OpenSeaOwnableDelegateProxy} from "./libraries/MarketplaceSignatureUtil.sol";
import {NftCollectionFunctions} from "./libraries/NftCollection.sol";

contract ClowderMainOwnable is Ownable {
    address public protocolFeeReceiver;
    uint256 public protocolFeeFraction = 100; // out of 10_000
    uint256 public protocolFeeFractionFromSelling = 100; // out of 10_000
    uint256 public minConsensusForSellingOverOrEqualBuyPrice = 5_000; // out of 10_000
    uint256 public minConsensusForSellingUnderBuyPrice = 10_000; // out of 10_000

    /**
     * @notice [onlyOwner] Change the protocol fee receiver
     * @param _protocolFeeReceiver new receiver
     */
    function changeProtocolFeeReceiver(address _protocolFeeReceiver)
        external
        onlyOwner
    {
        protocolFeeReceiver = _protocolFeeReceiver;
    }

    /**
     * @notice [onlyOwner] Change the protocol fee fraction
     * @param _protocolFeeFraction new fee fraction (out of 10_000)
     */
    function changeProtocolFeeFraction(uint256 _protocolFeeFraction)
        external
        onlyOwner
    {
        protocolFeeFraction = _protocolFeeFraction;
    }

    /**
     * @notice [onlyOwner] Change the protocol fee fraction from selling
     * @param _protocolFeeFractionFromSelling new fee fraction (out of 10_000)
     */
    function changeProtocolFeeFractionFromSelling(
        uint256 _protocolFeeFractionFromSelling
    ) external onlyOwner {
        protocolFeeFractionFromSelling = _protocolFeeFractionFromSelling;
    }

    /**
     * @notice [onlyOwner] Change the min consensus for selling over or equal to buy price
     * @param _minConsensusForSellingOverOrEqualBuyPrice new min consensus (out of 10_000)
     */
    function changeMinConsensusForSellingOverOrEqualBuyPrice(
        uint256 _minConsensusForSellingOverOrEqualBuyPrice
    ) external onlyOwner {
        minConsensusForSellingOverOrEqualBuyPrice = _minConsensusForSellingOverOrEqualBuyPrice;
    }

    /**
     * @notice [onlyOwner] Change the min consensus for selling under buy price
     * @param _minConsensusForSellingUnderBuyPrice new min consensus (out of 10_000)
     */
    function changeMinConsensusForSellingUnderBuyPrice(
        uint256 _minConsensusForSellingUnderBuyPrice
    ) external onlyOwner {
        minConsensusForSellingUnderBuyPrice = _minConsensusForSellingUnderBuyPrice;
    }
}

contract ClowderMain is
    ClowderMainOwnable,
    ReentrancyGuard,
    ERC721Holder,
    ERC1155Holder,
    IERC1271
{
    address public immutable WETH;
    bytes32 public immutable EIP712_DOMAIN_SEPARATOR;

    // user => nonce => isUsedBuyNonce
    mapping(address => mapping(uint256 => bool)) public isUsedBuyNonce;
    // user => nonce => isUsedSellNonce
    mapping(address => mapping(uint256 => bool)) public isUsedSellNonce;
    // buyer => executionId => real contribution
    // Returns to zero when the owner is given their part of the
    // sale proceeds (claimProceeds).
    mapping(address => mapping(uint256 => uint256)) public realContributions;
    // executionId => Execution
    mapping(uint256 => Execution) public executions;

    constructor(
        address _WETH,
        address _protocolFeeReceiver
    ) {
        WETH = _WETH;
        protocolFeeReceiver = _protocolFeeReceiver;

        EIP712_DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ), // EIP712 domain typehash
                keccak256("Clowder"), // name
                keccak256(bytes("0.1")), // version
                block.chainid,
                address(this)
            )
        );
    }

    function cancelBuyOrders(uint256[] calldata buyOrderNonces) external {
        require(
            buyOrderNonces.length > 0,
            "Cancel: Must provide at least one nonce"
        );

        for (uint256 i = 0; i < buyOrderNonces.length; i++) {
            isUsedBuyNonce[msg.sender][buyOrderNonces[i]] = true; // used
        }
    }

    function cancelSellOrders(uint256[] calldata sellOrderNonces) external {
        require(
            sellOrderNonces.length > 0,
            "Cancel: Must provide at least one nonce"
        );

        for (uint256 i = 0; i < sellOrderNonces.length; i++) {
            isUsedSellNonce[msg.sender][sellOrderNonces[i]] = true; // cancelled
        }
    }

    /**
     * @notice Executes on an array of passive buy orders
     */
    function executeOnPassiveBuyOrders(
        BuyOrderV1[] calldata buyOrders,
        uint256 executorPrice,
        uint256 tokenId
    ) external nonReentrant {
        require(buyOrders.length > 0, "Execute: Must have at least one order");

        uint256 protocolFee = (protocolFeeFraction * executorPrice) / 10_000;
        uint256 price = executorPrice + protocolFee;
        address collection = buyOrders[0].collection;
        uint256 executionId = buyOrders[0].executionId;

        require(
            executions[executionId].collection == address(0),
            "Execute: Id already executed"
        );
        // creating the execution object immediately (extra measure to prevent reentrancy)
        executions[executionId] = Execution({
            collection: collection,
            buyPrice: price,
            tokenId: tokenId,
            sold: false,
            sellPrice: 0,
            listingEndTime: 0,
            openSeaOrderHash: bytes32(0),
            sellProtocolFee: 0
        });

        uint256 protocolFeeTransferred = 0;
        uint256 executorPriceTransferred = 0;

        // validate and process all the buy orders
        for (uint256 i = 0; i < buyOrders.length; i++) {
            BuyOrderV1 calldata order = buyOrders[i];
            // Validate order nonce usability
            require(
                !isUsedBuyNonce[order.signer][order.buyNonce],
                "Order nonce is unusable"
            );
            // Invalidating order nonce immediately (to avoid reentrancy
            // or even reusing the signature in this loop)
            // DO NOT separate from the above check, otherwise the order
            // nonce could be reused (you can check the
            // executeOnPassiveSellOrders for guidance). If you need separation
            // probably you can check the signer/nonces before "i".
            isUsedBuyNonce[order.signer][order.buyNonce] = true;
            // Validate order signature
            bytes32 orderHash = order.hash();
            require(
                SignatureUtil.verify(
                    orderHash,
                    order.signer,
                    order.v,
                    order.r,
                    order.s,
                    EIP712_DOMAIN_SEPARATOR
                ),
                "Signature: Invalid"
            );
            // Validate the order is not expired
            require(order.buyPriceEndTime >= block.timestamp, "Order expired");

            // Validate the order can accept the price
            require(order.canAcceptBuyPrice(price), "Order can't accept price");
            // Validate collection
            require(
                order.collection == collection,
                "Order collection mismatch"
            );
            // Validate executionId
            require(
                order.executionId == executionId,
                "Order executionId mismatch"
            );

            uint256 contribution = order.contribution;

            // transferring the protocol fee
            uint256 protocolWethAmount = Math.min(
                protocolFee - protocolFeeTransferred,
                contribution
            );
            protocolFeeTransferred += protocolWethAmount;
            _safeTransferWETH(
                order.signer,
                protocolFeeReceiver,
                protocolWethAmount
            );

            // transferring the protocol executor price
            uint256 executorPriceAmount = Math.min(
                executorPrice - executorPriceTransferred,
                contribution - protocolWethAmount
            );
            executorPriceTransferred += executorPriceAmount;
            _safeTransferWETH(order.signer, msg.sender, executorPriceAmount);

            // adding to the real contribution of the signer
            uint256 realContribution = protocolWethAmount + executorPriceAmount;
            realContributions[order.signer][executionId] += realContribution;
        } // ends the orders for loop

        // validating that we transferred the correct amounts of WETH
        require(
            protocolFeeTransferred == protocolFee,
            "Protocol fee not transferred correctly"
        );
        require(
            executorPriceTransferred == executorPrice,
            "Executor price not transferred correctly"
        );

        // transferring the NFT
        NftCollectionFunctions.transferNft(
            collection,
            msg.sender,
            address(this),
            tokenId
        );
    }

    function _invalidateNonces(BuyOrderV1[] calldata orders) internal {
        // Invalidating nonces
        for (uint256 i = 0; i < orders.length; i++) {
            BuyOrderV1 calldata order = orders[i];
            // Invalidating order nonce (to avoid reentrancy)
            isUsedSellNonce[order.signer][order.sellNonce] = true;
        }
    }

    function executeOnPassiveSellOrders(
        BuyOrderV1[] calldata orders,
        uint256 executorPrice
    ) external nonReentrant {
        require(orders.length > 0, "ExecuteSell: Must have at least one order");

        uint256 protocolFee = (protocolFeeFractionFromSelling * executorPrice) /
            10_000;
        uint256 price = executorPrice - protocolFee;
        uint256 executionId = orders[0].executionId;

        Execution storage execution = executions[executionId];

        /* Validations */

        require(execution.collection != address(0), "Execution doesn't exist");

        require(!execution.sold, "Execution already sold");

        BuyOrderV1Functions.validateSellOrdersParameters(
            isUsedSellNonce,
            realContributions,
            orders,
            executionId,
            execution,
            price,
            minConsensusForSellingOverOrEqualBuyPrice,
            minConsensusForSellingUnderBuyPrice
        );

        /* Invalidations */

        _invalidateNonces(orders);

        // marking as sold (to prevent reentrancy)
        execution.sold = true;

        // storing the price to be distributed among the owners
        execution.sellPrice = price;

        /* Giving away execution flow */

        // Validate signatures (includes interaction with
        // other contracts)
        BuyOrderV1Functions.validateSignatures(orders, EIP712_DOMAIN_SEPARATOR);

        // transferring the WETH from the caller to Clowder
        _safeTransferWETH(msg.sender, address(this), price);

        // transferring the protocol fee
        _safeTransferWETH(msg.sender, protocolFeeReceiver, protocolFee);

        // transferring the NFT
        NftCollectionFunctions.transferNft(
            execution.collection,
            address(this),
            msg.sender,
            execution.tokenId
        );
    }

    function listOnOpenSea(
        BuyOrderV1[] calldata orders,
        uint256 executorPrice,
        uint256 marketplaceFee // out of 10_000
    ) external nonReentrant {
        require(
            orders.length > 0,
            "ListOnMarketplace: Must have at least one order"
        );

        uint256 protocolFee = (protocolFeeFractionFromSelling * executorPrice) /
            10_000;
        uint256 price = executorPrice - protocolFee;
        uint256 executionId = orders[0].executionId;

        Execution storage execution = executions[executionId];

        /* Validations */

        require(execution.collection != address(0), "Execution doesn't exist");

        require(!execution.sold, "Execution already sold");

        uint256 minExpirationTime = BuyOrderV1Functions
            .validateSellOrdersParameters(
                isUsedSellNonce,
                realContributions,
                orders,
                executionId,
                execution,
                price,
                minConsensusForSellingOverOrEqualBuyPrice,
                minConsensusForSellingUnderBuyPrice
            );

        // Validate signatures (includes interaction with
        // other contracts)
        BuyOrderV1Functions.validateSignatures(orders, EIP712_DOMAIN_SEPARATOR);

        {
            // OpenSea stuff

            // Approving OpenSea to move the item (if not approved already) and WETH (yes, OpenSea requires this for the way it works)
            // initialize opensea proxy (check opensea-js)
            OpenSeaOwnableDelegateProxy myProxy = MarketplaceSignatureUtil
                .wyvernProxyRegistry
                .proxies(address(this));
                
            if (address(myProxy) == address(0)) {
                myProxy = MarketplaceSignatureUtil
                    .wyvernProxyRegistry
                    .registerProxy();
            }

            IERC721 erc721 = IERC721(execution.collection);
            if (!erc721.isApprovedForAll(address(this), address(myProxy))) {
                erc721.setApprovalForAll(address(myProxy), true);
            }

            IERC20 erc20 = IERC20(WETH);
            if (
                erc20.allowance(
                    address(this),
                    MarketplaceSignatureUtil.WyvernTokenTransferProxy
                ) < type(uint256).max
            ) {
                erc20.approve(
                    MarketplaceSignatureUtil.WyvernTokenTransferProxy,
                    type(uint256).max
                );
            }
        }

        // calculating list price
        uint256 listPrice = (10_000 * executorPrice) /
            (10_000 - marketplaceFee) +
            1;

        // creating the OpenSea sell order
        bytes32 _hash = MarketplaceSignatureUtil.buildAndGetOpenSeaOrderHash(
            address(this),
            execution.collection,
            execution.tokenId,
            listPrice,
            minExpirationTime,
            marketplaceFee,
            WETH
        );
        require(_hash != 0, "Hash must not be 0");

        // storing the hash by executionId (replacing the old one, so invalidating it)
        execution.openSeaOrderHash = _hash;
        // storing the last list price so we know how much to
        // to be awarded to each owner
        execution.sellPrice = price;
        // storing the protocol fee
        execution.sellProtocolFee = protocolFee;
        // storing the listing end time
        execution.listingEndTime = minExpirationTime;
    }

    function isValidSignature(bytes32 _hash, bytes calldata _signature)
        external
        view
        override
        returns (bytes4)
    {
        require(_hash != 0, "Hash must not be 0");
        uint256 executionId = uint256(bytes32(_signature[:32]));
        // Validate signatures
        if (executions[executionId].openSeaOrderHash == _hash) {
            return 0x1626ba7e;
        } else {
            return 0xffffffff;
        }
    }

    function claimNft(uint256 executionId, address to) external nonReentrant {
        Execution storage execution = executions[executionId];
        require(
            execution.collection != address(0),
            "ClaimNft: Execution doesn't exist"
        );
        require(!execution.sold, "ClaimNft: Execution already sold");
        /*
         * Invalidating immediately (extra measure to prevent reentrancy)
         * TODO: maybe we can zero the execution struct instead (?),
         * that way we save gas and also allow re-using the executionId
         */
        executions[executionId].sold = true;
        // validating real contribution
        uint256 realContribution = realContributions[msg.sender][executionId];
        require(
            execution.buyPrice == realContribution,
            "ClaimNft: wrong real contribution"
        );
        // just for claiming gas deductions
        realContributions[msg.sender][executionId] = 0;
        // transferring the NFT
        NftCollectionFunctions.transferNft(
            execution.collection,
            address(this),
            to,
            execution.tokenId
        );
    }

    function preClaim(uint256[] calldata executionIds) internal {
         // loop over the executions
        for (uint256 i = 0; i < executionIds.length; i++) {
            uint256 executionId = executionIds[i];
            Execution storage execution = executions[executionId];

            require(
                execution.collection != address(0),
                "PreClaim: Execution doesn't exist"
            );
            // Validating that we already sold the NFT
            // or that we don't have it anymore (if NFT was sold through a marketplace).
            // What about if nobody has claimed their proceeds from an old execution of the same NFT?
            // They wouldn't be allowed to claim proceeds until the current execution NFT is sold.
            // That's why the fee receiver should mark the execution as sold
            // as soon as the NFT is gone (sold), for now only
            // the fee receiver can receive the protocol sell fee. Do we need
            // to allow external arbitragers?
            // Another option is create a new contract per execution,
            // so this new contract holds the NFT, WETH and the execution struct,
            // would that be a bit more gas-expensive?
            bool clowderOwnsTheNft = IERC721(execution.collection).ownerOf(
                execution.tokenId
            ) == address(this);
            require(
                execution.sold || !clowderOwnsTheNft,
                "PreClaim: NFT has not been sold nor ask has been taken"
            );
            // Marking the execution as sold so future claimers don't need to
            // rely on checking whether Clowder owns the NFT or not
            if (!execution.sold) {
                execution.sold = true;
            }
        }
    }

    function claimProceeds(uint256[] calldata executionIds, address to)
        external
    {
        preClaim(executionIds);

        uint256 proceedsSum = 0;
        // loop over the executions
        for (uint256 i = 0; i < executionIds.length; i++) {
            uint256 executionId = executionIds[i];
            Execution storage execution = executions[executionId];

            // transferring the WETH to the signer
            uint256 realContribution = realContributions[msg.sender][
                executionId
            ];
            uint256 price = execution.sellPrice;
            // dust remains for the smart contract, that's ok
            uint256 proceeds = (realContribution * price) / execution.buyPrice;
            // to prevent double claiming:
            realContributions[msg.sender][executionId] = 0;
            proceedsSum += proceeds;
        }
        _safeTransferWETH(address(this), to, proceedsSum);
    }

    function claimProtocolFees(uint256[] calldata executionIds) external {
        preClaim(executionIds);

        uint256 feesSum = 0;
        // loop over the executions
        for (uint256 i = 0; i < executionIds.length; i++) {
            uint256 executionId = executionIds[i];
            Execution storage execution = executions[executionId];

            feesSum += execution.sellProtocolFee;
            // marking it zero so the protocol fee receiever can't receive it again
            execution.sellProtocolFee = 0;
        }
        _safeTransferWETH(address(this), protocolFeeReceiver, feesSum);
    }

    function _safeTransferWETH(
        address from,
        address to,
        uint256 amount
    ) internal {
        SafeERC20Transfer.safeERC20Transfer(WETH, from, to, amount);
    }
}
