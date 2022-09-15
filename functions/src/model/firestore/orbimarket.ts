export interface OrbiMarketCollection { // both in unix seconds
  name: string,  
  contract: string, 
  description?: string | null,
  bannerURL?: string | null,
  imageURL?: string | null,
  category?: string[] | null,
  socials?: SocialOrbiMarketCollection[] | null,
  floorPrice?: string | null,
  nfts?: Partial<OrbiMarketNFT>[] | null,
  timestamp?: number | null
}

export interface SocialOrbiMarketCollection {
  type: string,
  value: string
}

export interface OrbiMarketNFT {
  id: string,
  owner: string,
  listed: boolean,
  tokenId: string,
  isERC1155: boolean,
  nftAddress: string, // contract
  pricePerItem: string, // EVMOS or ATOM
  listedTime: string,
  lastSaleTime: string,
  lastSalePrice: string,
  payToken: string,
  lastSalePayToken: string,
  description?: string | null,
  image?: string | null, //https://nftstorage.link/{image}
  dna?: string | null,
  edition?: number | null,
  date?: number | null,
  attributes?: AttributeOrbiMarketCollection[] | null,  
}

export interface AttributeOrbiMarketCollection {
  trait_type: string,
  value: string,
  compiler: string,
}