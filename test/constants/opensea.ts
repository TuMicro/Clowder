import { WyvernProtocol } from "wyvern-js";

export class OpenSeaConstants {
  static readonly DEFAULT_GAS_INCREASE_FACTOR = 1.01;
  static readonly NULL_ADDRESS = WyvernProtocol.NULL_ADDRESS;
  static readonly NULL_BLOCK_HASH =
    "0x0000000000000000000000000000000000000000000000000000000000000000";
  static readonly OPENSEA_FEE_RECIPIENT =
    "0x5b3256965e7c3cf26e11fcaf296dfc8807c01073";
  static readonly INVERSE_BASIS_POINT = 10000;
  static readonly MAX_UINT_256 = WyvernProtocol.MAX_UINT_256;
  static readonly ENJIN_COIN_ADDRESS = "0xf629cbd94d3791c9250152bd8dfbdf380e2a3b9c";
  static readonly MANA_ADDRESS = "0x0f5d2fb29fb7d3cfee444a200298f468908cc942";
  static readonly ENJIN_ADDRESS = "0xfaaFDc07907ff5120a76b34b731b278c38d6043C";
  static readonly ENJIN_LEGACY_ADDRESS =
    "0x8562c38485B1E8cCd82E44F89823dA76C98eb0Ab";
  static readonly CK_ADDRESS = "0x06012c8cf97bead5deae237070f9587f8e7a266d";
  static readonly CK_RINKEBY_ADDRESS = "0x16baf0de678e52367adc69fd067e5edd1d33e3bf";
  static readonly WRAPPED_NFT_FACTORY_ADDRESS_MAINNET =
    "0xf11b5815b143472b7f7c52af0bfa6c6a2c8f40e1";
  static readonly WRAPPED_NFT_FACTORY_ADDRESS_RINKEBY =
    "0x94c71c87244b862cfd64d36af468309e4804ec09";
  static readonly WRAPPED_NFT_LIQUIDATION_PROXY_ADDRESS_MAINNET =
    "0x995835145dd85c012f3e2d7d5561abd626658c04";
  static readonly WRAPPED_NFT_LIQUIDATION_PROXY_ADDRESS_RINKEBY =
    "0xaa775Eb452353aB17f7cf182915667c2598D43d3";
  static readonly UNISWAP_FACTORY_ADDRESS_MAINNET =
    "0xc0a47dFe034B400B47bDaD5FecDa2621de6c4d95";
  static readonly UNISWAP_FACTORY_ADDRESS_RINKEBY =
    "0xf5D915570BC477f9B8D6C0E980aA81757A3AaC36";
  static readonly DEFAULT_WRAPPED_NFT_LIQUIDATION_UNISWAP_SLIPPAGE_IN_BASIS_POINTS = 1000;
  static readonly CHEEZE_WIZARDS_GUILD_ADDRESS = WyvernProtocol.NULL_ADDRESS; // TODO: Update this address once Dapper has deployed their mainnet contracts
  static readonly CHEEZE_WIZARDS_GUILD_RINKEBY_ADDRESS =
    "0x095731b672b76b00A0b5cb9D8258CD3F6E976cB2";
  static readonly CHEEZE_WIZARDS_BASIC_TOURNAMENT_ADDRESS =
    WyvernProtocol.NULL_ADDRESS; // TODO: Update this address once Dapper has deployed their mainnet contracts
  static readonly CHEEZE_WIZARDS_BASIC_TOURNAMENT_RINKEBY_ADDRESS =
    "0x8852f5F7d1BB867AAf8fdBB0851Aa431d1df5ca1";
  static readonly DECENTRALAND_ESTATE_ADDRESS =
    "0x959e104e1a4db6317fa58f8295f586e1a978c297";
  static readonly STATIC_CALL_TX_ORIGIN_ADDRESS =
    "0xbff6ade67e3717101dd8d0a7f3de1bf6623a2ba8";
  static readonly STATIC_CALL_TX_ORIGIN_RINKEBY_ADDRESS =
    "0xe291abab95677bc652a44f973a8e06d48464e11c";
  static readonly STATIC_CALL_CHEEZE_WIZARDS_ADDRESS = WyvernProtocol.NULL_ADDRESS; // TODO: Deploy this address once Dapper has deployed their mainnet contracts
  static readonly STATIC_CALL_CHEEZE_WIZARDS_RINKEBY_ADDRESS =
    "0x8a640bdf8886dd6ca1fad9f22382b50deeacde08";
  static readonly STATIC_CALL_DECENTRALAND_ESTATES_ADDRESS =
    "0x93c3cd7ba04556d2e3d7b8106ce0f83e24a87a7e";
  static readonly DEFAULT_BUYER_FEE_BASIS_POINTS = 0;
  static readonly DEFAULT_SELLER_FEE_BASIS_POINTS = 250;
  static readonly OPENSEA_SELLER_BOUNTY_BASIS_POINTS = 100;
  static readonly DEFAULT_MAX_BOUNTY = this.DEFAULT_SELLER_FEE_BASIS_POINTS;
  static readonly MIN_EXPIRATION_MINUTES = 15;
  static readonly MAX_EXPIRATION_MONTHS = 6;
  static readonly ORDER_MATCHING_LATENCY_SECONDS = 60 * 60 * 24 * 7;
  static readonly SELL_ORDER_BATCH_SIZE = 3;
  static readonly ORDERBOOK_VERSION = 1 as number;
  static readonly API_BASE_MAINNET = "https://api.opensea.io";
  static readonly API_BASE_RINKEBY = "https://testnets-api.opensea.io";
  static readonly SITE_HOST_MAINNET = "https://opensea.io";
  static readonly SITE_HOST_RINKEBY = "https://rinkeby.opensea.io";
  static readonly RPC_URL_PATH = "jsonrpc/v1/";
  static readonly MAINNET_PROVIDER_URL = `${this.API_BASE_MAINNET}/${this.RPC_URL_PATH}`;
  static readonly RINKEBY_PROVIDER_URL = `${this.API_BASE_RINKEBY}/${this.RPC_URL_PATH}`;
  static readonly ORDERBOOK_PATH = `/wyvern/v${this.ORDERBOOK_VERSION}`;
  static readonly API_PATH = `/api/v${this.ORDERBOOK_VERSION}`;
  
  static readonly EIP_712_ORDER_TYPES = {
    EIP712Domain: [
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "verifyingContract", type: "address" },
    ],
    Order: [
      { name: "exchange", type: "address" },
      { name: "maker", type: "address" },
      { name: "taker", type: "address" },
      { name: "makerRelayerFee", type: "uint256" },
      { name: "takerRelayerFee", type: "uint256" },
      { name: "makerProtocolFee", type: "uint256" },
      { name: "takerProtocolFee", type: "uint256" },
      { name: "feeRecipient", type: "address" },
      { name: "feeMethod", type: "uint8" },
      { name: "side", type: "uint8" },
      { name: "saleKind", type: "uint8" },
      { name: "target", type: "address" },
      { name: "howToCall", type: "uint8" },
      { name: "calldata", type: "bytes" },
      { name: "replacementPattern", type: "bytes" },
      { name: "staticTarget", type: "address" },
      { name: "staticExtradata", type: "bytes" },
      { name: "paymentToken", type: "address" },
      { name: "basePrice", type: "uint256" },
      { name: "extra", type: "uint256" },
      { name: "listingTime", type: "uint256" },
      { name: "expirationTime", type: "uint256" },
      { name: "salt", type: "uint256" },
      { name: "nonce", type: "uint256" },
    ],
  };
  
  static readonly EIP_712_WYVERN_DOMAIN_NAME = "Wyvern Exchange Contract";
  static readonly EIP_712_WYVERN_DOMAIN_VERSION = "2.3";
  static readonly MERKLE_VALIDATOR_MAINNET =
    "0xbaf2127b49fc93cbca6269fade0f7f31df4c88a7";
  static readonly MERKLE_VALIDATOR_RINKEBY =
    "0x45b594792a5cdc008d0de1c1d69faa3d16b3ddc1";


  // from https://github.com/ProjectWyvern/wyvern-js/blob/7823dfdf5a272ebbc6a46e66d23563a9d6cc1be2/src/utils/deployed.ts
  static readonly WyvernTokenTransferProxy_MAINNET = "0xe5c783ee536cf5e63e792988335c4255169be4e1";
  static readonly WyvernTokenTransferProxy_RINKEBY = "0xCdC9188485316BF6FA416d02B4F680227c50b89e";
  
}
