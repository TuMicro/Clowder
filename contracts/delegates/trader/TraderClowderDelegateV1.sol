// SPDX-License-Identifier: BUSL-1.1
pragma solidity >=0.8.13;

import {ClowderMain} from "../../ClowderMain.sol";
import {SellOrderV1, SellOrderV1Functions} from "./passiveorders/SellOrderV1.sol";
import {SeaportUtil} from "./interactionutils/SeaportUtil.sol";
import {Execution} from "../../libraries/execution/Execution.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract TraderClowderDelegateV1 is ReentrancyGuard {
    uint256 public constant minConsensusForSellingOverFairPrice = 5_000; // out of 10_000
    uint256 public constant minConsensusForSellingUnderOrEqualFairPrice =
        10_000; // out of 10_000
    uint256 public constant protocolFeeFractionFromSelling = 100; // out of 10_000

    ClowderMain public immutable clowderMain;
    uint256 public immutable executionId;

    bytes32 public immutable EIP712_DOMAIN_SEPARATOR;

    // user => nonce => isUsedSellNonce
    mapping(address => mapping(uint256 => bool)) public isUsedSellNonce;

    constructor(address _clowderMain, uint256 _executionId) {
        clowderMain = ClowderMain(_clowderMain);
        executionId = _executionId;

        EIP712_DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ), // EIP712 domain typehash
                keccak256("TraderClowderDelegate"), // name
                keccak256(bytes("0.1")), // version
                block.chainid,
                address(this)
            )
        );
    }

    // To be able to receive NFTs
    // Note: parameters must stay as it is a standard
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    // to be able to receive eth
    receive() external payable {}

    function cancelSellOrders(uint256[] calldata sellOrderNonces) external {
        require(
            sellOrderNonces.length > 0,
            "Cancel: Must provide at least one nonce"
        );

        for (uint256 i = 0; i < sellOrderNonces.length; i++) {
            isUsedSellNonce[msg.sender][sellOrderNonces[i]] = true; // cancelled
        }
    }

    function listOnSeaport(
        SellOrderV1[] calldata orders,
        uint256 fairPrice // out of 10_000
    ) external nonReentrant {
        require(
            orders.length > 0,
            "ListOnMarketplace: Must have at least one order"
        );

        // TODO: validate fairPrice

        /* Validations */

        (uint256 minExpirationTime, uint256 maxOfMinProceeds) = SellOrderV1Functions
            .validateSellOrdersParameters(
                isUsedSellNonce,
                clowderMain,
                orders,
                executionId,
                fairPrice,
                minConsensusForSellingOverFairPrice,
                minConsensusForSellingUnderOrEqualFairPrice
            );

        // Validate signatures (includes interaction with
        // other contracts)
        SellOrderV1Functions.validateSignatures(
            orders,
            EIP712_DOMAIN_SEPARATOR
        );

        SeaportUtil.approveConduitForERC721(
            orders[0].conduitController,
            orders[0].conduitKey,
            orders[0].collection,
            orders[0].tokenId
        );

        SeaportUtil.listERC721(
            orders[0],
            minExpirationTime,
            maxOfMinProceeds
        );

    }
}
