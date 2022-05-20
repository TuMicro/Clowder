// SPDX-License-Identifier: BUSL-1.1
pragma solidity >=0.8.4;

import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";
import {SignatureChecker} from '@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol';
import {ECDSA} from '@openzeppelin/contracts/utils/cryptography/ECDSA.sol';

library SignatureUtil {
    function verify(
        bytes32 hash,
        address signer,
        uint8 v,
        bytes32 r,
        bytes32 s,
        bytes32 domainSeparator
    ) internal view returns (bool) {
        require(signer != address(0), "SignatureUtil: Invalid signer");
        bytes memory signature = abi.encodePacked(r, s, v);
        bytes32 digest = ECDSA.toTypedDataHash(domainSeparator, hash);
        return SignatureChecker.isValidSignatureNow(signer, digest, signature);
    }
}
