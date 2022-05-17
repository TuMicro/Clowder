// SPDX-License-Identifier: BUSL-1.1
pragma solidity >=0.8.4;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

library NftCollectionFunctions {

    // interface IDs
    bytes4 public constant INTERFACE_ID_ERC721 = 0x80ac58cd;
    bytes4 public constant INTERFACE_ID_ERC1155 = 0xd9b67a26;

    function transferNft(
        address collection,
        address from,
        address to,
        uint256 tokenId
    ) internal {
        if (IERC165(collection).supportsInterface(INTERFACE_ID_ERC721)) {
            IERC721(collection).safeTransferFrom(from, to, tokenId);
        } else if (IERC165(collection).supportsInterface(INTERFACE_ID_ERC1155)) {
            IERC1155(collection).safeTransferFrom(from, to, tokenId, 1, "");
        } else {
            revert("Collection does not support ERC721 or ERC1155");
        }
    }
}
