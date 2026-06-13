import type { PredictConfig } from "./types";

export const predictConfig: PredictConfig = {
  serverUrl: "https://predict-server.testnet.mystenlabs.com",
  predictPackageId: "0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138",
  predictObjectId: "0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a",
  quoteAssetType: "e95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC",
  network: "testnet",
  mockMode: true,
  liveWalletFlow: false
};

export function getPredictQuoteAssetLabel(config: PredictConfig = predictConfig): string {
  return config.quoteAssetType.split("::").at(-1) ?? "DUSDC";
}
