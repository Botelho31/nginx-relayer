export interface RelayConfig{
  serverName: string
  relay: string
  https: boolean
  forceHttps: boolean
  staticServer: boolean
  staticServerPath?: string
}
