import { useMemo } from "react";
import {
  useCurrentAccount,
  useDAppKit,
  type UiWalletAccount
} from "@mysten/dapp-kit-react";
import type { Transaction } from "@mysten/sui/transactions";
import {
  AgentClaimPanel,
  type ClaimWalletProvider
} from "./AgentClaimPanel";

type PlatformFetcher = (url: string, init?: RequestInit) => Promise<Response>;

interface SuiDappKitAgentClaimPanelProps {
  apiBaseUrl: string;
  fetcher?: PlatformFetcher;
  registrationCode: string;
}

export function SuiDappKitAgentClaimPanel({
  apiBaseUrl,
  fetcher,
  registrationCode
}: SuiDappKitAgentClaimPanelProps) {
  const dAppKit = useDAppKit();
  const currentAccount = useCurrentAccount();
  const walletProvider = useMemo(
    () => currentAccount
      ? createDappKitWalletProvider({
      currentAccount,
        signAndExecuteTransaction: dAppKit.signAndExecuteTransaction
      })
      : null,
    [currentAccount, dAppKit.signAndExecuteTransaction]
  );

  return (
    <AgentClaimPanel
      apiBaseUrl={apiBaseUrl}
      claimButtonLabel="Claim"
      connectedWalletAddress={currentAccount?.address ?? null}
      fetcher={fetcher}
      manualClaimEnabled={false}
      missingWalletMessage="Connect owner wallet in the top menu before claiming."
      registrationCode={registrationCode}
      walletProvider={walletProvider}
    />
  );
}

interface CreateDappKitWalletProviderArgs {
  currentAccount: UiWalletAccount | null;
  signAndExecuteTransaction: (input: { transaction: Transaction }) => Promise<unknown>;
}

function createDappKitWalletProvider({
  currentAccount,
  signAndExecuteTransaction
}: CreateDappKitWalletProviderArgs): ClaimWalletProvider {
  return {
    getAccounts: () => currentAccount ? [currentAccount] : [],
    signAndExecuteTransaction: async ({ transaction }) => await signAndExecuteTransaction({ transaction })
  };
}
