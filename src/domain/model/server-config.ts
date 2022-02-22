import { Address } from './address'
import { RelayConfig } from './relay-config'

export interface ServerConfig{
  contactEmail: string
  project: string
  address: Address
  relays: RelayConfig[]
}
