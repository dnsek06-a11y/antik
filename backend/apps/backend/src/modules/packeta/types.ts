export type PacketaOptions = {
  apiPassword: string
  /** Numeric e-shop identifier assigned by Packeta/Zásilkovna. */
  eshopId: string
}

export type PacketaCreatePacketResult = {
  ok: boolean
  packetId?: string
  fault?: string
}
