// SPDX-License-Identifier: BUSL-1.1
pragma solidity >=0.8.4;

import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20, SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC721Holder} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {BuyOrderV1} from "./libraries/passiveorders/BuyOrderV1.sol";
import {SellOrderV1} from "./libraries/passiveorders/SellOrderV1.sol";
import {SignatureChecker} from "./libraries/SignatureChecker.sol";
import {NftCollectionFunctions} from "./libraries/NftCollection.sol";

contract ClowderMain is ReentrancyGuard, Ownable, ERC721Holder, ERC1155Holder {
    using SafeERC20 for IERC20;

    address public immutable WETH;
    bytes32 public immutable EIP712_DOMAIN_SEPARATOR;

    address public protocolFeeReceiver;
    uint256 public protocolFeeFraction; // out of 10_000

    // user => nonce => state (3 states: 0 = not used, 1 = cancelled, 2...n = executionId 0.. )
    mapping(address => mapping(uint256 => uint256)) public buyNonceState;
    // user => nonce => isUsed
    mapping(address => mapping(uint256 => bool)) public isUsedSellNonce;
    // buyer => executionId => real contribution
    mapping(address => mapping(uint256 => uint256)) public realContributions;
    Execution[] public executions; // preferring array for better code clarity

    struct Execution {
        address collection;
        uint256 buyPrice;
        uint256 tokenId;
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
        require(buyOrderNonces.length > 0, "Cancel: Must provide at least one nonce");

        for (uint256 i = 0; i < buyOrderNonces.length; i++) {
            buyNonceState[msg.sender][buyOrderNonces[i]] = 1; // cancelled
        }
    }
    
    function cancelSellOrders(uint256[] calldata sellOrderNonces) external {
        require(sellOrderNonces.length > 0, "Cancel: Must provide at least one nonce");

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

        uint256 protocolFeeTransferred = 0;
        uint256 executorPriceTransferred = 0;

        // validate all the buy orders
        for (uint256 i = 0; i < buyOrders.length; i++) {
            BuyOrderV1 calldata order = buyOrders[i];
            // Validate order nonce usability
            require(
                buyNonceState[order.signer][order.buyNonce] == 0,
                "Order nonce is unusable"
            );
            // Update order nonce storing the executionId
            buyNonceState[order.signer][order.buyNonce] = executions.length + 2;
            // Validate order signature
            bytes32 orderHash = order.hash();
            require(
                SignatureChecker.verify(
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

            uint256 contribution = order.contribution;

            // transfering the protocol fee
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

            // transfering the protocol executor price
            uint256 executorPriceAmount = Math.min(
                executorPrice - executorPriceTransferred,
                contribution - protocolWethAmount
            );
            executorPriceTransferred += executorPriceAmount;
            _safeTransferWETH(order.signer, msg.sender, executorPriceAmount);

            // assign the real contribution to the signer
            uint256 realContribution = protocolWethAmount + executorPriceAmount;
            realContributions[order.signer][
                executions.length // the execution struct is created after the loop
            ] = realContribution;
        }

        // validating that we transferred the correct amounts of WETH
        require(
            protocolFeeTransferred == protocolFee,
            "Protocol fee not transferred correctly"
        );
        require(
            executorPriceTransferred == executorPrice,
            "Executor price not transferred correctly"
        );

        // creating the execution object
        executions.push(
            Execution({
                collection: collection,
                buyPrice: price,
                tokenId: tokenId
            })
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
        BuyOrderV1[] calldata buyOrders,
        SellOrderV1[] calldata sellOrders,
        uint256 executorPrice
    ) external nonReentrant {
        require(
            buyOrders.length + sellOrders.length > 0,
            "ExecuteSell: Cannot be empty"
        );
        revert("TODO: Implement");
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

    function executionsLength() external view returns (uint) {
        return executions.length;
    }
}
