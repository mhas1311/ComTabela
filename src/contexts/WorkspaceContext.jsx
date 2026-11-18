import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { useAuth } from './AuthContext'
import { supabase } from '../lib/supabase'

const WorkspaceContext = createContext(null)

const DEFAULT_ACCOUNTS = [
  { id: 'acc-checking', name: 'Conta Principal', type: 'checking', initialBalance: 0, color: '#10b981' },
  { id: 'acc-wallet', name: 'Carteira Física', type: 'cash', initialBalance: 0, color: '#0ea5e9' },
  { id: 'acc-credit', name: 'Cartão de Crédito', type: 'credit', initialBalance: 0, color: '#f59e0b' },
]

const createDefaultState = () => ({
  budget: 0,
  operationsEnabled: false,
  privacyMode: false,
  bankrollInitial: 0,
  accounts: DEFAULT_ACCOUNTS,
  categoryBudgets: {},
  txAccounts: {},
  evEntries: [],
  inventoryItems: [],
})

const storageKeyFor = (userId) => `comtabela:workspace:v2:${userId}`
const LEGACY_MIGRATED_KEY = 'comtabela:legacy-migrated:v2'

function readLocalWorkspace(userId) {
  if (!userId) return createDefaultState()
  try {
    const raw = localStorage.getItem(storageKeyFor(userId))
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        ...createDefaultState(),
        ...parsed,
        accounts: Array.isArray(parsed.accounts) && parsed.accounts.length > 0 ? parsed.accounts : DEFAULT_ACCOUNTS,
        categoryBudgets: parsed.categoryBudgets && typeof parsed.categoryBudgets === 'object' ? parsed.categoryBudgets : {},
        txAccounts: parsed.txAccounts && typeof parsed.txAccounts === 'object' ? parsed.txAccounts : {},
        evEntries: Array.isArray(parsed.evEntries) ? parsed.evEntries : [],
        inventoryItems: Array.isArray(parsed.inventoryItems) ? parsed.inventoryItems : [],
      }
    }

    // Migração única e segura de chaves antigas sem escopo, removendo-as em seguida
    if (!localStorage.getItem(LEGACY_MIGRATED_KEY)) {
      const legacyBudget = localStorage.getItem('comtabela-budget')
      const legacyOps = localStorage.getItem('comtabela-operations')
      const legacyBankroll = localStorage.getItem('comtabela-bankroll')
      const legacyInventoryRaw = localStorage.getItem('comtabela-inventory')

      const hasAnyLegacy =
        legacyBudget !== null ||
        legacyOps !== null ||
        legacyBankroll !== null ||
        legacyInventoryRaw !== null

      if (hasAnyLegacy) {
        let legacyInventory = []
        try {
          legacyInventory = JSON.parse(legacyInventoryRaw || '[]')
        } catch {
          legacyInventory = []
        }

        const migrated = {
          ...createDefaultState(),
          budget: Number(legacyBudget) || 0,
          operationsEnabled: legacyOps === 'true',
          bankrollInitial: Number(legacyBankroll) || 0,
          inventoryItems: Array.isArray(legacyInventory)
            ? legacyInventory.map((item) => ({
                id: item.id || crypto.randomUUID(),
                name: item.name || 'Item',
                quantity: Number(item.quantity) || 1,
                cost: Number(item.cost) || 0,
                target: Number(item.target) || 0,
                feePct: Number(item.feePct) || 0,
                status: item.status || 'in_stock',
                soldPrice: item.soldPrice != null ? Number(item.soldPrice) : null,
                soldDate: item.soldDate || null,
              }))
            : [],
        }

        localStorage.setItem(storageKeyFor(userId), JSON.stringify(migrated))
        localStorage.setItem(LEGACY_MIGRATED_KEY, userId)
        localStorage.removeItem('comtabela-budget')
        localStorage.removeItem('comtabela-operations')
        localStorage.removeItem('comtabela-bankroll')
        localStorage.removeItem('comtabela-inventory')
        return migrated
      }
    }
  } catch {
    // Fallback seguro em memória se localStorage falhar
  }
  return createDefaultState()
}

export function WorkspaceProvider({ children }) {
  const { user } = useAuth()
  const [state, setState] = useState(createDefaultState)
  const [syncing, setSyncing] = useState(false)
  const tableSupportedRef = useRef(true)
  const syncTimerRef = useRef(null)

  useEffect(() => {
    if (!user?.id) {
      setState(createDefaultState())
      return undefined
    }

    const local = readLocalWorkspace(user.id)
    setState(local)

    let cancelled = false

    const hydrateRemote = async () => {
      if (!supabase) return

      // 1. Tenta ler da tabela dedicada public.user_workspace (se criada via SUPABASE_POLICY.md)
      if (tableSupportedRef.current) {
        const { data, error } = await supabase
          .from('user_workspace')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle()

        if (!error && data) {
          if (cancelled) return
          const merged = {
            ...local,
            budget: Number(data.budget) || 0,
            operationsEnabled: Boolean(data.operations_enabled),
            bankrollInitial: Number(data.bankroll_initial) || 0,
            accounts: Array.isArray(data.accounts) && data.accounts.length > 0 ? data.accounts : local.accounts,
            categoryBudgets: data.category_budgets || local.categoryBudgets,
            txAccounts: data.tx_accounts || local.txAccounts,
            evEntries: Array.isArray(data.ev_entries) ? data.ev_entries : local.evEntries,
            inventoryItems: Array.isArray(data.inventory_items) ? data.inventory_items : local.inventoryItems,
          }
          setState(merged)
          try {
            localStorage.setItem(storageKeyFor(user.id), JSON.stringify(merged))
          } catch {
            // ignora quota
          }
          return
        }

        if (error && (error.code === '42P01' || error.code === 'PGRST205' || String(error.message || '').includes('user_workspace'))) {
          tableSupportedRef.current = false
        }
      }

      // 2. Fallback transparente para user_metadata autenticado do usuário no Supabase Auth
      const meta = user.user_metadata?.comtabela_workspace
      if (meta && typeof meta === 'object' && !cancelled) {
        const merged = {
          ...local,
          budget: meta.budget != null ? Number(meta.budget) : local.budget,
          operationsEnabled: meta.operationsEnabled != null ? Boolean(meta.operationsEnabled) : local.operationsEnabled,
          bankrollInitial: meta.bankrollInitial != null ? Number(meta.bankrollInitial) : local.bankrollInitial,
          accounts: Array.isArray(meta.accounts) && meta.accounts.length > 0 ? meta.accounts : local.accounts,
          categoryBudgets: meta.categoryBudgets || local.categoryBudgets,
          txAccounts: meta.txAccounts || local.txAccounts,
          evEntries: Array.isArray(meta.evEntries) ? meta.evEntries : local.evEntries,
          inventoryItems: Array.isArray(meta.inventoryItems) ? meta.inventoryItems : local.inventoryItems,
        }
        setState(merged)
        try {
          localStorage.setItem(storageKeyFor(user.id), JSON.stringify(merged))
        } catch {
          // ignora quota
        }
      }
    }

    hydrateRemote()

    return () => {
      cancelled = true
      if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current)
    }
  }, [user?.id, user?.user_metadata?.comtabela_workspace])

  const persistWorkspace = useCallback(
    (updater) => {
      setState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }
        if (user?.id) {
          try {
            localStorage.setItem(storageKeyFor(user.id), JSON.stringify(next))
          } catch {
            // ignora quota
          }

          if (supabase) {
            if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current)
            syncTimerRef.current = window.setTimeout(async () => {
              setSyncing(true)
              try {
                if (tableSupportedRef.current) {
                  const { error } = await supabase.from('user_workspace').upsert(
                    {
                      user_id: user.id,
                      budget: Number(next.budget) || 0,
                      operations_enabled: Boolean(next.operationsEnabled),
                      bankroll_initial: Number(next.bankrollInitial) || 0,
                      accounts: next.accounts,
                      category_budgets: next.categoryBudgets,
                      tx_accounts: next.txAccounts,
                      ev_entries: next.evEntries,
                      inventory_items: next.inventoryItems,
                      updated_at: new Date().toISOString(),
                    },
                    { onConflict: 'user_id' }
                  )
                  if (!error) {
                    setSyncing(false)
                    return
                  }
                  if (error.code === '42P01' || error.code === 'PGRST205' || String(error.message || '').includes('user_workspace')) {
                    tableSupportedRef.current = false
                  }
                }

                // Fallback leve em user_metadata
                await supabase.auth.updateUser({
                  data: {
                    comtabela_workspace: {
                      budget: Number(next.budget) || 0,
                      operationsEnabled: Boolean(next.operationsEnabled),
                      bankrollInitial: Number(next.bankrollInitial) || 0,
                      accounts: next.accounts,
                      categoryBudgets: next.categoryBudgets,
                      txAccounts: Object.fromEntries(Object.entries(next.txAccounts).slice(-400)),
                      evEntries: next.evEntries.slice(0, 150),
                      inventoryItems: next.inventoryItems.slice(0, 150),
                    },
                  },
                })
              } finally {
                setSyncing(false)
              }
            }, 650)
          }
        }
        return next
      })
    },
    [user?.id]
  )

  const togglePrivacyMode = useCallback(() => {
    persistWorkspace((prev) => ({ ...prev, privacyMode: !prev.privacyMode }))
  }, [persistWorkspace])

  const updateBudget = useCallback(
    (budgetValue) => {
      persistWorkspace((prev) => ({ ...prev, budget: Math.max(0, Number(budgetValue) || 0) }))
    },
    [persistWorkspace]
  )

  const setOperationsEnabled = useCallback(
    (enabled) => {
      persistWorkspace((prev) => ({ ...prev, operationsEnabled: Boolean(enabled) }))
    },
    [persistWorkspace]
  )

  const updateBankrollInitial = useCallback(
    (value) => {
      persistWorkspace((prev) => ({ ...prev, bankrollInitial: Math.max(0, Number(value) || 0) }))
    },
    [persistWorkspace]
  )

  const setCategoryBudget = useCallback(
    (categoryId, limitValue) => {
      persistWorkspace((prev) => {
        const nextMap = { ...prev.categoryBudgets }
        const num = Number(limitValue)
        if (!num || num <= 0) {
          delete nextMap[categoryId]
        } else {
          nextMap[categoryId] = num
        }
        return { ...prev, categoryBudgets: nextMap }
      })
    },
    [persistWorkspace]
  )

  const addAccount = useCallback(
    ({ name, type = 'checking', initialBalance = 0, color = '#10b981' }) => {
      const created = {
        id: `acc-${crypto.randomUUID().slice(0, 8)}`,
        name: name.trim(),
        type,
        initialBalance: Number(initialBalance) || 0,
        color,
      }
      persistWorkspace((prev) => ({ ...prev, accounts: [...prev.accounts, created] }))
      return created
    },
    [persistWorkspace]
  )

  const updateAccount = useCallback(
    (id, patch) => {
      persistWorkspace((prev) => ({
        ...prev,
        accounts: prev.accounts.map((acc) => (acc.id === id ? { ...acc, ...patch } : acc)),
      }))
    },
    [persistWorkspace]
  )

  const removeAccount = useCallback(
    (id) => {
      persistWorkspace((prev) => {
        if (prev.accounts.length <= 1) return prev
        const nextAccounts = prev.accounts.filter((acc) => acc.id !== id)
        const nextTxAccounts = { ...prev.txAccounts }
        Object.keys(nextTxAccounts).forEach((txId) => {
          if (nextTxAccounts[txId] === id) delete nextTxAccounts[txId]
        })
        return { ...prev, accounts: nextAccounts, txAccounts: nextTxAccounts }
      })
    },
    [persistWorkspace]
  )

  const assignTxAccounts = useCallback(
    (entriesMap) => {
      persistWorkspace((prev) => {
        const nextTxAccounts = { ...prev.txAccounts }
        Object.entries(entriesMap).forEach(([txId, accId]) => {
          if (!accId) delete nextTxAccounts[txId]
          else nextTxAccounts[txId] = accId
        })
        return { ...prev, txAccounts: nextTxAccounts }
      })
    },
    [persistWorkspace]
  )

  const addEvEntry = useCallback(
    (entry) => {
      const record = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        date: entry.date,
        description: entry.description || 'Entrada EV+',
        odd: Number(entry.odd) || 0,
        fairOdd: Number(entry.fairOdd) || 0,
        edgePct: Number(entry.edgePct) || 0,
        stake: Number(entry.stake) || 0,
        ev: Number(entry.ev) || 0,
        status: entry.status || 'pending',
      }
      persistWorkspace((prev) => ({ ...prev, evEntries: [record, ...prev.evEntries] }))
      return record
    },
    [persistWorkspace]
  )

  const updateEvEntry = useCallback(
    (id, patch) => {
      persistWorkspace((prev) => ({
        ...prev,
        evEntries: prev.evEntries.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      }))
    },
    [persistWorkspace]
  )

  const removeEvEntry = useCallback(
    (id) => {
      persistWorkspace((prev) => ({
        ...prev,
        evEntries: prev.evEntries.filter((item) => item.id !== id),
      }))
    },
    [persistWorkspace]
  )

  const restoreEvEntry = useCallback(
    (entry) => {
      persistWorkspace((prev) => ({
        ...prev,
        evEntries: [entry, ...prev.evEntries],
      }))
    },
    [persistWorkspace]
  )

  const addInventoryItem = useCallback(
    (item) => {
      const record = {
        id: crypto.randomUUID(),
        name: item.name.trim(),
        quantity: Math.max(1, Number(item.quantity) || 1),
        cost: Math.max(0, Number(item.cost) || 0),
        target: Math.max(0, Number(item.target) || 0),
        feePct: Math.max(0, Math.min(100, Number(item.feePct) || 0)),
        status: item.status || 'in_stock',
        soldPrice: item.soldPrice != null ? Number(item.soldPrice) : null,
        soldDate: item.soldDate || null,
      }
      persistWorkspace((prev) => ({ ...prev, inventoryItems: [record, ...prev.inventoryItems] }))
      return record
    },
    [persistWorkspace]
  )

  const updateInventoryItem = useCallback(
    (id, patch) => {
      persistWorkspace((prev) => ({
        ...prev,
        inventoryItems: prev.inventoryItems.map((row) => (row.id === id ? { ...row, ...patch } : row)),
      }))
    },
    [persistWorkspace]
  )

  const removeInventoryItem = useCallback(
    (id) => {
      persistWorkspace((prev) => ({
        ...prev,
        inventoryItems: prev.inventoryItems.filter((row) => row.id !== id),
      }))
    },
    [persistWorkspace]
  )

  const restoreInventoryItem = useCallback(
    (item) => {
      persistWorkspace((prev) => ({
        ...prev,
        inventoryItems: [item, ...prev.inventoryItems],
      }))
    },
    [persistWorkspace]
  )

  return (
    <WorkspaceContext.Provider
      value={{
        ...state,
        syncing,
        togglePrivacyMode,
        updateBudget,
        setOperationsEnabled,
        updateBankrollInitial,
        setCategoryBudget,
        addAccount,
        updateAccount,
        removeAccount,
        assignTxAccounts,
        addEvEntry,
        updateEvEntry,
        removeEvEntry,
        restoreEvEntry,
        addInventoryItem,
        updateInventoryItem,
        removeInventoryItem,
        restoreInventoryItem,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  )
}

WorkspaceProvider.propTypes = {
  children: PropTypes.node.isRequired,
}

// eslint-disable-next-line react-refresh/only-export-components
export const useWorkspace = () => useContext(WorkspaceContext)
