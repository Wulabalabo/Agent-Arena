import { createDAppKit } from "@mysten/dapp-kit-react";
import { SuiGrpcClient } from "@mysten/sui/grpc";

const grpcUrls = {
  testnet: "https://fullnode.testnet.sui.io:443"
} as const;

export const dAppKit = createDAppKit({
  networks: ["testnet"],
  createClient: (network) => new SuiGrpcClient({ network, baseUrl: grpcUrls[network] }),
  storageKey: "agent-arena:selected-wallet"
});

declare module "@mysten/dapp-kit-react" {
  interface Register {
    dAppKit: typeof dAppKit;
  }
}
