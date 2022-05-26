// SPDX-License-Identifier: BUSL-1.1
pragma solidity >=0.8.4;

import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20, SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC721Holder} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {BuyOrderV1} from "./libraries/passiveorders/BuyOrderV1.sol";
import {SignatureUtil} from "./libraries/SignatureUtil.sol";
import {NftCollectionFunctions} from "./libraries/NftCollection.sol";

contract ClowderMain is ReentrancyGuard, Ownable, ERC721Holder, ERC1155Holder {
    using SafeERC20 for IERC20;

    address public immutable WETH;
    bytes32 public immutable EIP712_DOMAIN_SEPARATOR;

    address public protocolFeeReceiver;
    uint256 public protocolFeeFraction; // out of 10_000
    uint256 public protocolFeeFractionFromSelling; // out of 10_000
    uint256 public minConsensusForSellingOverOrEqualBuyPrice = 5_000; // out of 10_000
    uint256 public minConsensusForSellingUnderBuyPrice = 10_000; // out of 10_000

    // user => nonce => isUsedBuyNonce
    mapping(address => mapping(uint256 => bool)) public isUsedBuyNonce;
    // user => nonce => isUsedSellNonce
    mapping(address => mapping(uint256 => bool)) public isUsedSellNonce;
    // buyer => executionId => real contribution
    mapping(address => mapping(uint256 => uint256)) public realContributions;
    // executionId => Execution
    mapping(uint256 => Execution) executions;

    struct Execution {
        address collection; // zero to evaluate as non-existant
        uint256 buyPrice;
        uint256 tokenId;
        bool sold;
        uint256 sellPrice;
    }

    constructor(
        address _WETH,
        address _protocolFeeReceiver,
        uint256 _protocolFeeFraction
    ) {
        WETH = _WETH;
        protocolFeeReceiver = _protocolFeeReceiver;
        protocolFeeFraction = _protocolFeeFraction;

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
            sellPrice: 0
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
            // Invalidating order nonce immediately (to avoid re-use/reentrancy)
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

    function executeOnPassiveSellOrders(
        BuyOrderV1[] calldata orders,
        uint256 executorPrice
    ) external nonReentrant {
        require(orders.length > 0, "ExecuteSell: Must have at least one order");

        uint256 protocolFee = (protocolFeeFractionFromSelling * executorPrice) /
            10_000;
        uint256 price = executorPrice - protocolFee;
        address collection = orders[0].collection;
        uint256 executionId = orders[0].executionId;

        // transferring the protocol fee
        _safeTransferWETH(msg.sender, protocolFeeReceiver, protocolFee);

        Execution storage execution = executions[executionId];
        require(
            execution.collection != address(0),
            "ExecuteSell: Execution doesn't exist"
        );
        require(
            execution.collection == collection,
            "ExecuteSell: Execution collection must match order's"
        );
        require(!execution.sold, "ExecuteSell: Execution already sold");
        // invalidating immediately (extra measure to prevent reentrancy)
        execution.sold = true;
        // storing the price to be distributed among the owners
        execution.sellPrice = price;

        uint256 realContributionOnBoard = 0;

        // validate and process all the sell orders
        for (uint256 i = 0; i < orders.length; i++) {
            BuyOrderV1 calldata order = orders[i];
            // Validate order nonce usability
            require(
                !isUsedSellNonce[order.signer][order.sellNonce],
                "Order nonce is unusable"
            );
            // Invalidating order nonce immediately (to avoid re-use/reentrancy)
            isUsedSellNonce[order.signer][order.sellNonce] = true;
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
            require(order.sellPriceEndTime >= block.timestamp, "Order expired");
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
            uint256 realContribution = realContributions[order.signer][
                executionId
            ];
            // search if signer already voted
            bool isVoter = false;
            for (uint256 j = 0; j < i; j++) {
                if (orders[j].signer == order.signer) {
                    isVoter = true;
                    break;
                }
            }
            // Validating that the signer has not voted yet
            require(!isVoter, "Signer already voted");

            // Validating price acceptance
            require(
                order.canAcceptSellPrice(price),
                "Order can't accept price"
            );

            // Counting the "votes" in favor of this price
            realContributionOnBoard += realContribution;
        } // ends the contributors for loop

        // validating price consensus
        if (price >= execution.buyPrice) {
            // we need at least N out of 10_000 consensus
            require(
                realContributionOnBoard * 10_000 >=
                    execution.buyPrice *
                        minConsensusForSellingOverOrEqualBuyPrice,
                "Selling over or equal buyPrice: consensus not reached"
            );
        } else {
            // we need a different consensus ratio
            require(
                realContributionOnBoard * 10_000 >=
                    execution.buyPrice * minConsensusForSellingUnderBuyPrice,
                "Selling under buyPrice: consensus not reached"
            );
        }

        // transferring the WETH from the caller to Clowder
        _safeTransferWETH(msg.sender, address(this), price);

        // transferring the NFT
        NftCollectionFunctions.transferNft(
            collection,
            address(this),
            msg.sender,
            execution.tokenId
        );
    }

    function claimNft(uint256 executionId, address to) external nonReentrant {
        Execution memory execution = executions[executionId];
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

    function claimProceeds(uint256[] calldata executionIds, address to)
        external
    {
        uint256 proceedsSum = 0;
        // loop over the executions
        for (uint256 i = 0; i < executionIds.length; i++) {
            uint256 executionId = executionIds[i];
            Execution storage execution = executions[executionId];

            require(
                execution.collection != address(0),
                "ClaimProceeds: Execution doesn't exist"
            );
            // Validating that we already sold the NFT or we don't have the NFT anymore (marketplace bid taken)
            bool clowderOwnsTheNft = IERC721(execution.collection).ownerOf(
                execution.tokenId
            ) == address(this);
            require(
                execution.sold || !clowderOwnsTheNft,
                "ClaimProceeds: NFT has not been sold or ask has been taken"
            );

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

    function _safeTransferWETH(
        address from,
        address to,
        uint256 amount
    ) internal {
        if (amount != 0) {
            IERC20(WETH).safeTransferFrom(from, to, amount);
        }
    }
}
