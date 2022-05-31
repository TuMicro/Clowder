// SPDX-License-Identifier: BUSL-1.1
pragma solidity >=0.8.4;

import {SignatureUtil} from "./../SignatureUtil.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Execution} from "./../execution/Execution.sol";

using BuyOrderV1Functions for BuyOrderV1 global;

// DO NOT CHANGE the struct, create a new order file instead.
// If chaging the struct is extremely necessary, don't forget to 
// update the hash constant and hash function below.
struct BuyOrderV1 {
    
    address signer; // order signer

    // general order parameters
    address collection; // collection address
    uint256 executionId; // buy order execution id
    uint256 contribution; // WETH contribution

    // buy order parameters
    uint256 buyPrice; // buy WETH price
    uint256 buyPriceEndTime; // order expiration time (set 0 for omitting)
    uint256 buyNonce; // for differentiating orders (it is not possible to re-use the nonce)

    // sell order parameters
    uint256 sellPrice; // sell WETH price 
    uint256 sellPriceEndTime; // sell order expiration time (set 0 for omitting)
    uint256 sellNonce;

    // signature parameters
    uint8 v;
    bytes32 r;
    bytes32 s;
}

/**
 * @title PassiveTradeOrders
 * @notice
 */
library BuyOrderV1Functions {
    bytes32 internal constant PASSIVE_BUY_ORDER_HASH = 0x72e794cb40f2ebfd460c7e8f21afeacac61a902963a831638aeff99e28bc690f;

    function hash(BuyOrderV1 memory passiveOrder) public pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    PASSIVE_BUY_ORDER_HASH,
                    passiveOrder.signer,
                    passiveOrder.collection,
                    passiveOrder.executionId,
                    passiveOrder.contribution,
                    passiveOrder.buyPrice,
                    passiveOrder.buyPriceEndTime,
                    passiveOrder.buyNonce,
                    passiveOrder.sellPrice,
                    passiveOrder.sellPriceEndTime,
                    passiveOrder.sellNonce
                )
            );
    }

    function canAcceptBuyPrice(BuyOrderV1 memory passiveOrder, uint256 price) public pure returns (bool) {
        return passiveOrder.buyPrice >= price;
    }
    
    function canAcceptSellPrice(BuyOrderV1 memory passiveOrder, uint256 price) public pure returns (bool) {
        return passiveOrder.sellPrice <= price;
    }

    
    // Validate signatures (includes interaction with
    // other contracts)
    // Remember that we give away execution flow
    // in case the signer is a contract (isValidSignature)
    function validateSignatures(
        BuyOrderV1[] calldata orders,
        bytes32 domainSeparator
    ) public view {
        for (uint256 i = 0; i < orders.length; i++) {
            BuyOrderV1 calldata order = orders[i];
            // Validate order signature
            bytes32 orderHash = hash(order);
            require(
                SignatureUtil.verify(
                    orderHash,
                    order.signer,
                    order.v,
                    order.r,
                    order.s,
                    domainSeparator
                ),
                "Signature: Invalid"
            );
        }
    }

    function validateSellOrdersParameters(
        mapping(address => mapping(uint256 => bool)) storage _isUsedSellNonce,
        mapping(address => mapping(uint256 => uint256)) storage _realContributions,
        BuyOrderV1[] calldata orders,
        uint256 executionId,
        Execution storage execution,
        uint256 price,
        uint256 minConsensusForSellingOverOrEqualBuyPrice,
        uint256 minConsensusForSellingUnderBuyPrice
    ) public view returns (uint256) {
        // mapping(address => mapping(uint256 => bool))
        //     storage _isUsedSellNonce = isUsedSellNonce;
        // mapping(address => mapping(uint256 => uint256))
        //     storage _realContributions = realContributions;
        // Execution storage execution = executions[executionId];

        uint256 minExpirationTime = type(uint256).max;
        uint256 realContributionOnBoard = 0;
        // Validate orders parameters, no need to access state
        for (uint256 i = 0; i < orders.length; i++) {
            BuyOrderV1 calldata order = orders[i];

            // Validate the order is not expired
            require(order.sellPriceEndTime >= block.timestamp, "Order expired");
            // Validate collection
            require(
                order.collection == execution.collection,
                "Order collection mismatch"
            );
            // Validate executionId
            require(
                order.executionId == executionId,
                "Order executionId mismatch"
            );
            // Validating that the signer has not voted yet
            for (uint256 j = 0; j < i; j++) {
                if (orders[j].signer == order.signer) {
                    require(false, "Signer already voted");
                }
            }
            // Validating price acceptance
            require(
                canAcceptSellPrice(order, price),
                "Order can't accept price"
            );
            // updating the min expiration time
            minExpirationTime = Math.min(
                minExpirationTime,
                order.sellPriceEndTime
            );

            /* State required for tne following lines */

            // Validate order nonce usability
            require(
                !_isUsedSellNonce[order.signer][order.sellNonce],
                "Order nonce is unusable"
            );
            // counting the "votes" in favor of this price
            realContributionOnBoard += _realContributions[order.signer][
                executionId
            ];
        } // ends the voters for loop

        // Validating price consensus
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

        return minExpirationTime;
    }
}
