// SPDX-License-Identifier: BUSL-1.1
pragma solidity >=0.8.4;

struct Execution {
    address collection; // zero to evaluate as non-existant
    uint256 buyPrice;
    uint256 tokenId;
    bool sold;
    
    /* Marketplace listing parameters */
    uint256 sellPrice; // if not sold yet, this is the amount we will recieve
    // from a marketplace in case it is listed for sale
    uint256 listingEndTime; // expiration time of the listing
    uint256 sellProtocolFee; // only has value when a marketplace listing happens
    // otherwise it is zero because the protocol fee is transferred immediately
    
    /* Marketplace listing hashes */
    bytes32 openSeaOrderHash;
    bytes32 looksRareOrderHash;
}
