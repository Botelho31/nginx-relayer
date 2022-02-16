import { Address } from "./address";
import { RelayConfig } from "./relay-config";

export interface ServerConfig{
  contactEmail: String
  project: String
  address: Address
  relays: RelayConfig[]
}
