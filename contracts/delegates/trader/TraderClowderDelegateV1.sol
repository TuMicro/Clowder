// SPDX-License-Identifier: BUSL-1.1
pragma solidity >=0.8.13;

import {ClowderMain} from "../../ClowderMain.sol";
import {SellOrderV1, SellOrderV1Functions} from "./passiveorders/SellOrderV1.sol";
import {SeaportUtil} from "./interactionutils/SeaportUtil.sol";
import {Execution} from "../../libraries/execution/Execution.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {ReservoirOracle} from "./external/reservoiroracle/ReservoirOracle.sol";

contract TraderClowderDelegateV1 is ReentrancyGuard, ReservoirOracle {
    // constants
    uint256 public constant minConsensusForSellingOverFairPrice = 5_000; // out of 10_000
    uint256 public constant minConsensusForSellingUnderOrEqualFairPrice =
        10_000; // out of 10_000
    uint256 public constant protocolFeeFractionFromSelling = 100; // out of 10_000, TODO: add this to the 0xsplit

    // immutable variables
    ClowderMain public immutable clowderMain;
    uint256 public immutable executionId;
    address public immutable reservoirOracleAddress;
    bytes32 public immutable EIP712_DOMAIN_SEPARATOR;

    // user => nonce => isUsedSellNonce
    mapping(address => mapping(uint256 => bool)) public isUsedSellNonce;

    constructor(
        address _clowderMain,
        uint256 _executionId,
        address _reservoirOracleAddress
    ) {
        clowderMain = ClowderMain(_clowderMain);
        executionId = _executionId;
        reservoirOracleAddress = _reservoirOracleAddress;

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
        Message calldata message
    ) external nonReentrant {
        require(
            orders.length > 0,
            "ListOnMarketplace: Must have at least one order"
        );

        /* Validations */

        uint256 fairPrice = verifyReservoirPrice(orders[0].collection, message);
        // TODO: ratify by Clowder oracle

        (
            uint256 minExpirationTime,
            uint256 maxOfMinProceeds,
            uint256 realContributionOnBoard
        ) = SellOrderV1Functions.validateSellOrdersParameters(
                isUsedSellNonce,
                clowderMain,
                orders,
                executionId
            );

        validatePriceConsensus(
            fairPrice,
            maxOfMinProceeds,
            realContributionOnBoard
        );

        // Includes interaction with
        // other contracts
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

        SeaportUtil.listERC721(orders[0], minExpirationTime, maxOfMinProceeds);
    }

    function validatePriceConsensus(
        uint256 fairPrice,
        uint256 maxOfMinProceeds,
        uint256 realContributionOnBoard
    ) internal view {
        (, uint256 buyPrice, ) = clowderMain.executions(executionId);

        // Validating price consensus
        if (maxOfMinProceeds > fairPrice) {
            if (minConsensusForSellingOverFairPrice == 10_000) {
                // we need 10_000 out of 10_000 consensus
                require(
                    realContributionOnBoard == buyPrice,
                    "Selling over fairPrice: consensus not reached"
                );
            } else {
                // we need more than N out of 10_000 consensus
                require(
                    realContributionOnBoard * 10_000 >
                        buyPrice * minConsensusForSellingOverFairPrice,
                    "Selling over fairPrice: consensus not reached"
                );
            }
        } else {
            // we need a different consensus ratio
            require(
                realContributionOnBoard * 10_000 >=
                    buyPrice * minConsensusForSellingUnderOrEqualFairPrice,
                "Selling u/e fairPrice: consensus not reached"
            );
        }
    }

    function verifyReservoirPrice(
        address collection,
        Message calldata message
    ) internal view returns (uint256) {
        // Construct the message id using EIP-712 structured-data hashing
        bytes32 id = keccak256(
            abi.encode(
                keccak256(
                    // from: https://github.com/reservoirprotocol/indexer/blob/v5.296.1/packages/indexer/src/api/endpoints/oracle/get-collection-floor-ask/v5.ts#LL204C30-L204C30
                    "ContractWideCollectionPrice(uint8 kind,uint256 twapSeconds,address contract)"
                ),
                PriceKind.TWAP,
                24 hours,
                collection
            )
        );

        // Validate the message
        uint256 maxMessageAge = 5 minutes;
        if (
            !_verifyMessage(id, maxMessageAge, message, reservoirOracleAddress)
        ) {
            revert InvalidMessage();
        }

        (address messageCurrency, uint256 price) = abi.decode(
            message.payload,
            (address, uint256)
        );
        require(
            0x0000000000000000000000000000000000000000 == messageCurrency,
            "Wrong currency"
        );

        return price;
    }
}
