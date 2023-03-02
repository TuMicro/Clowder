// SPDX-License-Identifier: BUSL-1.1
pragma solidity >=0.8.4;

struct Execution {
    address collection; // zero to evaluate as non-existant
    uint256 buyPrice;
    uint256 tokenId;
}
