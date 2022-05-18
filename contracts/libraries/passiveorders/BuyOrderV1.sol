// SPDX-License-Identifier: BUSL-1.1
pragma solidity >=0.8.4;

using BuyOrderV1Functions for BuyOrderV1 global;

// DO NOT CHANGE the struct, either create a new Order file or update the hash hardcoded below
struct BuyOrderV1 {
    
    address signer; // order signer

    // buy order parameters
    address collection; // collection address
    uint256 executionId; // buy order execution id
    uint256 contribution; // WETH contribution
    uint256 buyPrice; // buy WETH price
    uint256 buyPriceEndTime; // order expiration time
    uint256 buyNonce; // for differentiating orders (it is not possible to re-use the nonce)

    // sell order parameters (it you don't want to 
    // set this out you can set a very high price
    // or an expired time)
    uint256 sellPrice; // sell WETH price 
    uint256 sellPriceEndTime; // sell order expiration time
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

    function hash(BuyOrderV1 memory passiveOrder) internal pure returns (bytes32) {
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

    function canAcceptBuyPrice(BuyOrderV1 memory passiveOrder, uint256 price) internal pure returns (bool) {
        return passiveOrder.buyPrice >= price;
    }
}