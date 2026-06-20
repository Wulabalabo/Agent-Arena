import type { CoinBalanceReader, PredictConfig } from "./types";

export function createJsonRpcBalanceReader(config: PredictConfig): CoinBalanceReader {
  return {
    async getSuiBalance(address) {
      return await getBalanceRaw(config.suiRpcUrl, [address]);
    },
    async getCoinBalance(address, coinType) {
      return await getBalanceRaw(config.suiRpcUrl, [address, coinType]);
    }
  };
}

async function getBalanceRaw(rpcUrl: string, params: unknown[]): Promise<string> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "suix_getBalance",
      params
    })
  });

  if (!response.ok) {
    throw new Error(`SUI_RPC_BALANCE_FAILED:${response.status}`);
  }

  const body = await response.json();
  const totalBalance = body?.result?.totalBalance;
  if (typeof totalBalance !== "string") {
    throw new Error("SUI_RPC_BALANCE_MISSING");
  }

  return totalBalance;
}
