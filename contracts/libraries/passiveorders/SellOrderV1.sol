// SPDX-License-Identifier: BUSL-1.1
pragma solidity >=0.8.4;

using SellOrderV1Functions for SellOrderV1 global;

// DO NOT CHANGE the struct, either create a new Order file or update the hash hardcoded below
struct SellOrderV1 {
    address signer; // order signer

    // sell order parameters
    uint256 buyNonce; // for getting the executionId
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
library SellOrderV1Functions {
    bytes32 internal constant PASSIVE_SELL_ORDER_HASH = "TODO: fill this";

    function hash(SellOrderV1 memory passiveOrder) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    PASSIVE_SELL_ORDER_HASH,
                    passiveOrder.signer,
                    passiveOrder.buyNonce,
                    passiveOrder.sellPrice,
                    passiveOrder.sellPriceEndTime,
                    passiveOrder.sellNonce
                )
            );
    }

    function canAcceptSellPrice(SellOrderV1 memory passiveOrder, uint256 price) internal pure returns (bool) {
        return passiveOrder.sellPrice <= price;
    }
}
