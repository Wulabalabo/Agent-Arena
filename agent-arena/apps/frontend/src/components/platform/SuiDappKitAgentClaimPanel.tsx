import { useMemo } from "react";
import {
  useCurrentAccount,
  useDAppKit,
  type UiWalletAccount
} from "@mysten/dapp-kit-react";
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
        signPersonalMessage: dAppKit.signPersonalMessage
      })
      : null,
    [currentAccount, dAppKit.signPersonalMessage]
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
  signPersonalMessage: (input: { message: Uint8Array; account?: UiWalletAccount }) => Promise<unknown>;
}

function createDappKitWalletProvider({
  currentAccount,
  signPersonalMessage
}: CreateDappKitWalletProviderArgs): ClaimWalletProvider {
  return {
    getAccounts: () => currentAccount ? [currentAccount] : [],
    signPersonalMessage: async ({ message }) => await signPersonalMessage({
      message,
      ...(currentAccount ? { account: currentAccount } : {})
    })
  };
}
