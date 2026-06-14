import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ReaderTransaction, TransactionStatus } from "@/types/domain";
import { useSessionStore } from "@/stores/sessionStore";

type TransactionState = {
  transactionsByUser: Record<string, ReaderTransaction[]>;
  upsertTransaction: (transaction: Omit<ReaderTransaction, "id" | "userId" | "createdAtISO" | "updatedAtISO">) => void;
  updateTransactionStatus: (
    orderId: string,
    status: TransactionStatus,
    redirectUrl?: string,
    targetUserId?: string
  ) => void;
  hydrateTransactionsForUser: (targetUserId: string, transactions: ReaderTransaction[]) => void;
};

function nowIso() {
  return new Date().toISOString();
}

function currentUserId() {
  return useSessionStore.getState().user?.id ?? "guest";
}

function sortTransactions(list: ReaderTransaction[]) {
  return [...list].sort((a, b) => {
    const da = +new Date(a.updatedAtISO || a.createdAtISO || 0);
    const db = +new Date(b.updatedAtISO || b.createdAtISO || 0);
    return db - da;
  });
}

export const useTransactionStore = create<TransactionState>()(
  persist(
    (set) => ({
      transactionsByUser: {},

      upsertTransaction: (transaction) => {
        set((state) => {
          const uid = currentUserId();
          const list = state.transactionsByUser[uid] ?? [];
          const existing = list.find((item) => item.orderId === transaction.orderId);

          if (existing) {
            return {
              ...state,
              transactionsByUser: {
                ...state.transactionsByUser,
                [uid]: list.map((item) =>
                  item.orderId === transaction.orderId
                    ? {
                        ...item,
                        ...transaction,
                        updatedAtISO: nowIso(),
                      }
                    : item
                ),
              },
            };
          }

          const next: ReaderTransaction = {
            ...transaction,
            id: `trx_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`,
            userId: uid,
            createdAtISO: nowIso(),
            updatedAtISO: nowIso(),
          };

          return {
            ...state,
            transactionsByUser: {
              ...state.transactionsByUser,
              [uid]: [next, ...list],
            },
          };
        });
      },

      updateTransactionStatus: (orderId, status, redirectUrl, targetUserId) => {
        set((state) => {
          const uid = targetUserId || currentUserId();
          const list = state.transactionsByUser[uid] ?? [];

          return {
            ...state,
            transactionsByUser: {
              ...state.transactionsByUser,
              [uid]: list.map((item) =>
                item.orderId === orderId
                  ? {
                      ...item,
                      status,
                      redirectUrl: redirectUrl ?? item.redirectUrl,
                      updatedAtISO: nowIso(),
                    }
                  : item
              ),
            },
          };
        });
      },

      hydrateTransactionsForUser: (targetUserId, transactions) => {
        set((state) => {
          const uid = targetUserId.trim();
          if (!uid) return state;

          const existing = state.transactionsByUser[uid] ?? [];
          const nextByOrderId = new Map(existing.map((item) => [item.orderId, item]));

          for (const transaction of transactions) {
            if (!transaction.orderId.trim()) continue;
            nextByOrderId.set(transaction.orderId, {
              ...transaction,
              userId: uid,
            });
          }

          return {
            ...state,
            transactionsByUser: {
              ...state.transactionsByUser,
              [uid]: sortTransactions(Array.from(nextByOrderId.values())),
            },
          };
        });
      },
    }),
    { name: "naraloka_transactions_v1" }
  )
);
