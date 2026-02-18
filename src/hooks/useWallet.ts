import { useState, useEffect, useCallback } from "react";
import { getWalletBalanceAndCoins, getWalletTransactions, type WalletTransaction } from "@/lib/wallet";

export function useWallet(customerId: string | undefined) {
  const [balance, setBalance] = useState(0);
  const [coins, setCoins] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!customerId) {
      setLoading(false);
      return;
    }
    const [wallet, tx] = await Promise.all([
      getWalletBalanceAndCoins(customerId),
      getWalletTransactions(customerId, { limit: 20 }),
    ]);
    setBalance(wallet.balance);
    setCoins(wallet.coins);
    setTransactions(tx);
    setLoading(false);
  }, [customerId]);

  useEffect(() => {
    load();
  }, [load]);

  return { balance, coins, transactions, loading, refresh: load };
}
