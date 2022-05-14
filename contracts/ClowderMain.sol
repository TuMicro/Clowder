// SPDX-License-Identifier: BUSL-1.1
pragma solidity >=0.8.4;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

contract ClowderMain is Ownable {
    uint256 public nPurrs;
    string public purr = "rrrRRr rrrR rrR [purr]";

    function pet() public onlyOwner returns (string memory) {
        nPurrs++;
        return purr;
    }
}
