import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Check,
  Edit3,
  Filter,
  Plus,
  Repeat,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { useToast } from '../contexts/ToastContext'
import { addMonthsISO, currentMonthISO, formatDateBR, todayISO } from '../lib/date'
import { formatMoney } from '../lib/formatters'
import ExportButton from '../components/ExportButton'
import ConfirmDialog from '../components/ConfirmDialog'
import { PageSkeleton } from '../components/Skeleton'

export default function Transactions() {
  const { user } = useAuth()
  const { accounts, txAccounts, assignTxAccounts, privacyMode } = useWorkspace()
  const { toast } = useToast()

  const [rawTransactions, setRawTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  // Formulário de adição
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState('expense')
  const [categoryId, setCategoryId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [date, setDate] = useState(todayISO)
  const [initialSettled, setInitialSettled] = useState(false)
  const [frequency, setFrequency] = useState('single') // single | installment | recurring
  const [repeatCount, setRepeatCount] = useState('6')
  const [splitTotal, setSplitTotal] = useState(true)
  const [adding, setAdding] = useState(false)

  // Filtros e ordenação
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMonth, setFilterMonth] = useState(currentMonthISO)
  const [filterType, setFilterType] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterAccount, setFilterAccount] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all') // all | settled | pending
  const [sortBy, setSortBy] = useState('date_desc')

  // Edição inline / card
  const [editingId, setEditingId] = useState(null)
  const [editDescription, setEditDescription] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editType, setEditType] = useState('expense')
  const [editCategoryId, setEditCategoryId] = useState('')
  const [editAccountId, setEditAccountId] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editStatus, setEditStatus] = useState('pending')

  // Exclusão
  const [pendingDelete, setPendingDelete] = useState(null)

  useEffect(() => {
    document.title = 'Transações — ComTabela'
  }, [])

  useEffect(() => {
    if (!accountId && accounts.length > 0) {
      setAccountId(accounts[0].id)
    }
  }, [accounts, accountId])

  const loadAll = useCallback(async () => {
    if (!user?.id || !supabase) return
    const [{ data: catData, error: catErr }, { data: txData, error: txErr }] = await Promise.all([
      supabase.from('categories').select('*').eq('user_id', user.id).order('name'),
      supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false }),
    ])

    if (catErr || txErr) {
      console.error(catErr || txErr)
      toast({ title: 'Erro ao carregar transações', variant: 'error' })
    } else {
      setCategories(catData || [])
      setRawTransactions(txData || [])
    }
    setLoading(false)
  }, [user?.id, toast])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const transactions = useMemo(() => {
    const defaultAcc = accounts[0]
    return rawTransactions.map((t) => {
      const cat = categories.find((c) => c.id === t.category_id) || null
      const mappedAccId = txAccounts[t.id] || defaultAcc?.id || ''
      const acc = accounts.find((a) => a.id === mappedAccId) || defaultAcc
      return {
        ...t,
        category: cat,
        accountId: acc?.id || '',
        accountName: acc?.name || 'Conta Principal',
      }
    })
  }, [rawTransactions, categories, accounts, txAccounts])

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const list = transactions.filter((t) => {
      if (filterMonth && !t.date?.startsWith(filterMonth)) return false
      if (filterType !== 'all' && t.type !== filterType) return false
      if (filterCategory !== 'all') {
        if (filterCategory === 'none' && t.category_id) return false
        if (filterCategory !== 'none' && t.category_id !== filterCategory) return false
      }
      if (filterAccount !== 'all' && t.accountId !== filterAccount) return false
      if (filterStatus !== 'all') {
        const isSettled = t.type === 'income' ? t.status === 'received' : t.status === 'paid'
        if (filterStatus === 'settled' && !isSettled) return false
        if (filterStatus === 'pending' && isSettled) return false
      }
      if (q) {
        const hay = `${t.description || ''} ${t.category?.name || ''} ${t.accountName || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })

    list.sort((a, b) => {
      if (sortBy === 'date_asc') return (a.date || '').localeCompare(b.date || '')
      if (sortBy === 'amount_desc') return (Number(b.amount) || 0) - (Number(a.amount) || 0)
      if (sortBy === 'amount_asc') return (Number(a.amount) || 0) - (Number(b.amount) || 0)
      return (b.date || '').localeCompare(a.date || '')
    })

    return list
  }, [
    transactions,
    searchQuery,
    filterMonth,
    filterType,
    filterCategory,
    filterAccount,
    filterStatus,
    sortBy,
  ])

  const filteredSummary = useMemo(
    () =>
      filteredTransactions.reduce(
        (acc, t) => {
          const val = Number(t.amount) || 0
          if (t.type === 'income') acc.income += val
          else acc.expense += val
          return acc
        },
        { income: 0, expense: 0 }
      ),
    [filteredTransactions]
  )

  const formCategories = useMemo(
    () => categories.filter((cat) => cat.type === type),
    [categories, type]
  )

  const getSituationBadge = (t) => {
    const situation = t.status || 'pending'
    if (t.type === 'income') {
      if (situation === 'received') {
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/70">
            Recebido
          </span>
        )
      }
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-950/75 text-amber-300 border border-amber-800/70">
          Pendente
        </span>
      )
    }

    if (situation === 'paid') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/70">
          Pago
        </span>
      )
    }

    return (
      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-950/75 text-rose-300 border border-rose-800/70">
        Pendente
      </span>
    )
  }

  const getSituationOptionsFor = (txnType) =>
    txnType === 'income'
      ? [
          { value: 'pending', label: 'Pendente' },
          { value: 'received', label: 'Recebido' },
        ]
      : [
          { value: 'pending', label: 'Pendente' },
          { value: 'paid', label: 'Pago' },
        ]

  const toggleSituation = async (t) => {
    if (!supabase || !user?.id) return
    const isIncome = t.type === 'income'
    const next = isIncome
      ? t.status === 'received'
        ? 'pending'
        : 'received'
      : t.status === 'paid'
        ? 'pending'
        : 'paid'

    const { error } = await supabase
      .from('transactions')
      .update({ status: next })
      .eq('id', t.id)
      .eq('user_id', user.id)

    if (error) {
      toast({ title: 'Erro ao atualizar situação', variant: 'error' })
      return
    }
    loadAll()
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    const cleanDesc = description.trim()
    const numericAmount = Number(amount)
    if (!cleanDesc || !Number.isFinite(numericAmount) || numericAmount <= 0 || !supabase || !user?.id) {
      toast({
        title: 'Dados inválidos',
        description: 'Informe uma descrição e um valor maior que zero.',
        variant: 'error',
      })
      return
    }

    const totalCount =
      frequency === 'single' ? 1 : Math.max(2, Math.min(48, parseInt(repeatCount, 10) || 2))

    const firstStatus = initialSettled ? (type === 'income' ? 'received' : 'paid') : 'pending'

    const rowsToInsert = []
    if (frequency === 'installment') {
      const baseInstallment = splitTotal
        ? Math.floor((numericAmount / totalCount) * 100) / 100
        : Number(numericAmount.toFixed(2))
      const remainder = splitTotal
        ? Number((numericAmount - baseInstallment * totalCount).toFixed(2))
        : 0

      for (let idx = 0; idx < totalCount; idx += 1) {
        const installmentValue = idx === 0 ? Number((baseInstallment + remainder).toFixed(2)) : baseInstallment
        rowsToInsert.push({
          user_id: user.id,
          description: `${cleanDesc} (${idx + 1}/${totalCount})`,
          amount: installmentValue,
          type,
          category_id: categoryId || null,
          date: addMonthsISO(date, idx),
          status: idx === 0 ? firstStatus : 'pending',
        })
      }
    } else if (frequency === 'recurring') {
      for (let idx = 0; idx < totalCount; idx += 1) {
        rowsToInsert.push({
          user_id: user.id,
          description: cleanDesc,
          amount: Number(numericAmount.toFixed(2)),
          type,
          category_id: categoryId || null,
          date: addMonthsISO(date, idx),
          status: idx === 0 ? firstStatus : 'pending',
        })
      }
    } else {
      rowsToInsert.push({
        user_id: user.id,
        description: cleanDesc,
        amount: Number(numericAmount.toFixed(2)),
        type,
        category_id: categoryId || null,
        date,
        status: firstStatus,
      })
    }

    setAdding(true)
    const { data: insertedRows, error } = await supabase
      .from('transactions')
      .insert(rowsToInsert)
      .select('id')
    setAdding(false)

    if (error) {
      console.error('Erro ao adicionar transação:', error)
      toast({ title: 'Erro ao registrar transação', variant: 'error' })
      return
    }

    if (accountId && Array.isArray(insertedRows) && insertedRows.length > 0) {
      const mapping = {}
      insertedRows.forEach((r) => {
        mapping[r.id] = accountId
      })
      assignTxAccounts(mapping)
    }

    setDescription('')
    setAmount('')
    setFrequency('single')
    toast({
      title:
        rowsToInsert.length > 1
          ? `${rowsToInsert.length} lançamentos gerados`
          : 'Transação registrada',
      description: cleanDesc,
    })
    loadAll()
  }

  const startEdit = (t) => {
    setEditingId(t.id)
    setEditDescription(t.description || '')
    setEditAmount(t.amount != null ? String(t.amount) : '')
    setEditType(t.type || 'expense')
    setEditCategoryId(t.category_id || '')
    setEditAccountId(t.accountId || accounts[0]?.id || '')
    setEditDate(t.date || todayISO())
    setEditStatus(t.status || 'pending')
  }

  const cancelEdit = () => setEditingId(null)

  const saveEdit = async (id) => {
    const cleanDesc = editDescription.trim()
    const numAmount = Number(editAmount)
    if (!cleanDesc || !Number.isFinite(numAmount) || numAmount <= 0 || !supabase || !user?.id) {
      toast({ title: 'Verifique descrição e valor', variant: 'error' })
      return
    }

    const validStatuses = editType === 'income' ? ['pending', 'received'] : ['pending', 'paid']
    const normalizedStatus = validStatuses.includes(editStatus) ? editStatus : 'pending'

    const { error } = await supabase
      .from('transactions')
      .update({
        description: cleanDesc,
        amount: Number(numAmount.toFixed(2)),
        type: editType,
        category_id: editCategoryId || null,
        date: editDate || todayISO(),
        status: normalizedStatus,
      })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Erro ao salvar transação:', error)
      toast({ title: 'Erro ao salvar alterações', variant: 'error' })
      return
    }

    if (editAccountId) {
      assignTxAccounts({ [id]: editAccountId })
    }

    setEditingId(null)
    toast({ title: 'Transação atualizada' })
    loadAll()
  }

  const confirmDelete = async () => {
    const target = pendingDelete
    setPendingDelete(null)
    if (!target || !supabase || !user?.id) return

    const savedAccId = target.accountId
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', target.id)
      .eq('user_id', user.id)

    if (error) {
      toast({ title: 'Erro ao excluir transação', variant: 'error' })
      return
    }

    assignTxAccounts({ [target.id]: null })
    loadAll()

    toast({
      title: 'Transação excluída',
      description: target.description,
      actionLabel: 'Desfazer',
      onAction: async () => {
        const { data: restored } = await supabase
          .from('transactions')
          .insert({
            user_id: user.id,
            description: target.description,
            amount: Number(target.amount),
            type: target.type,
            category_id: target.category_id || null,
            date: target.date,
            status: target.status || 'pending',
          })
          .select('id')
          .single()
        if (restored?.id && savedAccId) {
          assignTxAccounts({ [restored.id]: savedAccId })
        }
        loadAll()
      },
    })
  }

  const clearFilters = () => {
    setSearchQuery('')
    setFilterMonth('')
    setFilterType('all')
    setFilterCategory('all')
    setFilterAccount('all')
    setFilterStatus('all')
    setSortBy('date_desc')
  }

  if (loading) return <PageSkeleton cards={3} rows={6} />

  return (
    <main className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100">
            Transações
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Registre entradas, despesas, parcelamentos e lançamentos recorrentes
          </p>
        </div>

        <ExportButton
          transactions={filteredTransactions}
          filePrefix={`comtabela_transacoes_${filterMonth || 'completo'}`}
        />
      </header>

      {/* Formulário Nova Transação */}
      <form onSubmit={handleAdd} className="surface-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-100">Novo lançamento</h2>

          <div className="inline-flex bg-slate-900 border border-slate-800 rounded-xl p-1 self-start">
            {[
              ['single', 'Única'],
              ['installment', 'Parcelada'],
              ['recurring', 'Fixa mensal'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                id={`btn-freq-${key}`}
                onClick={() => setFrequency(key)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  frequency === key
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
          <div className="lg:col-span-2">
            <label htmlFor="tx-desc" className="block text-xs text-slate-400 mb-1">
              Descrição
            </label>
            <input
              id="tx-desc"
              type="text"
              placeholder="Ex.: Salário, Supermercado, Notebook..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-base w-full"
              required
            />
          </div>

          <div>
            <label htmlFor="tx-amount" className="block text-xs text-slate-400 mb-1">
              {frequency === 'installment' && splitTotal ? 'Valor total (R$)' : 'Valor (R$)'}
            </label>
            <input
              id="tx-amount"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input-base w-full"
              required
            />
          </div>

          <div>
            <label htmlFor="tx-type" className="block text-xs text-slate-400 mb-1">
              Tipo
            </label>
            <select
              id="tx-type"
              value={type}
              onChange={(e) => {
                setType(e.target.value)
                setCategoryId('')
              }}
              className="input-base w-full"
            >
              <option value="expense">Despesa</option>
              <option value="income">Receita</option>
            </select>
          </div>

          <div>
            <label htmlFor="tx-category" className="block text-xs text-slate-400 mb-1">
              Categoria
            </label>
            <select
              id="tx-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="input-base w-full"
            >
              <option value="">Sem categoria</option>
              {formCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="tx-date" className="block text-xs text-slate-400 mb-1">
              {frequency === 'single' ? 'Data' : '1º vencimento'}
            </label>
            <input
              id="tx-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input-base w-full"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 items-end pt-1">
          <div>
            <label htmlFor="tx-account" className="block text-xs text-slate-400 mb-1">
              Conta / Carteira
            </label>
            <select
              id="tx-account"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="input-base w-full"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>

          {frequency !== 'single' && (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label htmlFor="tx-repeat-count" className="block text-xs text-slate-400 mb-1">
                  {frequency === 'installment' ? 'Nº de parcelas' : 'Repetir por (meses)'}
                </label>
                <input
                  id="tx-repeat-count"
                  type="number"
                  min="2"
                  max="48"
                  value={repeatCount}
                  onChange={(e) => setRepeatCount(e.target.value)}
                  className="input-base w-full"
                />
              </div>
              {frequency === 'installment' && (
                <label className="flex items-center gap-1.5 text-xs text-slate-300 pb-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={splitTotal}
                    onChange={(e) => setSplitTotal(e.target.checked)}
                    className="accent-emerald-500 rounded"
                  />
                  <span>Dividir total</span>
                </label>
              )}
            </div>
          )}

          <label className="flex items-center gap-2 text-xs text-slate-300 py-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={initialSettled}
              onChange={(e) => setInitialSettled(e.target.checked)}
              className="accent-emerald-500 rounded"
            />
            <span>
              {type === 'income'
                ? 'Marcar já como recebido'
                : 'Marcar já como pago'}
            </span>
          </label>

          <div className="sm:col-span-2 lg:col-span-1 flex justify-end">
            <button
              type="submit"
              id="btn-add-transaction"
              disabled={adding}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors cursor-pointer"
            >
              {frequency === 'single' ? <Plus size={16} /> : <Repeat size={16} />}
              <span>{adding ? 'Salvando...' : 'Registrar'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Barra de Filtros + Resumo Filtrado */}
      <section className="surface-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Filter size={14} className="text-emerald-400" />
            <span>Filtros e pesquisa ({filteredTransactions.length} resultados)</span>
          </div>
          <button
            type="button"
            id="btn-clear-filters"
            onClick={clearFilters}
            className="text-xs text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
          >
            Ver todos os períodos
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="relative lg:col-span-2">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              id="filter-search"
              type="search"
              placeholder="Buscar descrição, categoria ou conta..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-base w-full pl-9"
            />
          </div>

          <input
            id="filter-month"
            aria-label="Filtrar por mês"
            type="month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="input-base w-full"
          />

          <select
            id="filter-type"
            aria-label="Filtrar por tipo"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="input-base w-full"
          >
            <option value="all">Todos os tipos</option>
            <option value="expense">Apenas despesas</option>
            <option value="income">Apenas receitas</option>
          </select>

          <select
            id="filter-category"
            aria-label="Filtrar por categoria"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="input-base w-full"
          >
            <option value="all">Todas categorias</option>
            <option value="none">Sem categoria</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          <select
            id="filter-status-sort"
            aria-label="Filtrar por situação"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="input-base w-full"
          >
            <option value="all">Todas situações</option>
            <option value="pending">Pendentes</option>
            <option value="settled">Pagos / Recebidos</option>
          </select>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-slate-800/80 text-xs">
          <div className="flex flex-wrap items-center gap-4 font-mono-nums">
            <span className="text-slate-400">
              Receitas:{' '}
              <strong className="text-emerald-400">
                {formatMoney(filteredSummary.income, privacyMode)}
              </strong>
            </span>
            <span className="text-slate-400">
              Despesas:{' '}
              <strong className="text-rose-400">
                {formatMoney(filteredSummary.expense, privacyMode)}
              </strong>
            </span>
            <span className="text-slate-400">
              Resultado:{' '}
              <strong
                className={
                  filteredSummary.income - filteredSummary.expense >= 0
                    ? 'text-sky-400'
                    : 'text-rose-400'
                }
              >
                {formatMoney(filteredSummary.income - filteredSummary.expense, privacyMode)}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <select
              id="filter-account"
              aria-label="Filtrar por conta"
              value={filterAccount}
              onChange={(e) => setFilterAccount(e.target.value)}
              className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-300"
            >
              <option value="all">Todas as contas</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>

            <select
              id="sort-transactions"
              aria-label="Ordenar transações"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-300"
            >
              <option value="date_desc">Mais recentes</option>
              <option value="date_asc">Mais antigas</option>
              <option value="amount_desc">Maior valor</option>
              <option value="amount_asc">Menor valor</option>
            </select>
          </div>
        </div>
      </section>

      {/* Lista / Tabela de Transações */}
      <section className="surface-card overflow-hidden">
        {filteredTransactions.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <p className="text-sm font-medium text-slate-300">Nenhuma transação encontrada</p>
            <p className="text-xs text-slate-500">
              Ajuste os filtros acima ou cadastre um novo lançamento.
            </p>
          </div>
        ) : (
          <>
            {/* Visão Desktop em Tabela */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/90 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4">Data</th>
                    <th className="py-3.5 px-4">Descrição</th>
                    <th className="py-3.5 px-4">Categoria</th>
                    <th className="py-3.5 px-4">Conta</th>
                    <th className="py-3.5 px-4">Situação</th>
                    <th className="py-3.5 px-4 text-right">Valor</th>
                    <th className="py-3.5 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {filteredTransactions.map((t) => {
                    const isEditing = editingId === t.id
                    return (
                      <tr key={t.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="py-3.5 px-4 whitespace-nowrap font-mono-nums text-slate-300">
                          {isEditing ? (
                            <input
                              type="date"
                              value={editDate}
                              onChange={(e) => setEditDate(e.target.value)}
                              className="input-base py-1 px-2 text-xs w-34"
                            />
                          ) : (
                            formatDateBR(t.date)
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-slate-100 font-medium">
                          {isEditing ? (
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                className="input-base py-1 px-2 text-xs w-full"
                              />
                              <select
                                value={editType}
                                onChange={(e) => {
                                  setEditType(e.target.value)
                                  setEditCategoryId('')
                                }}
                                className="input-base py-1 px-2 text-xs w-28"
                              >
                                <option value="expense">Despesa</option>
                                <option value="income">Receita</option>
                              </select>
                            </div>
                          ) : (
                            t.description
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-slate-300">
                          {isEditing ? (
                            <select
                              value={editCategoryId}
                              onChange={(e) => setEditCategoryId(e.target.value)}
                              className="input-base py-1 px-2 text-xs w-full"
                            >
                              <option value="">Sem categoria</option>
                              {categories
                                .filter((cat) => cat.type === editType)
                                .map((cat) => (
                                  <option key={cat.id} value={cat.id}>
                                    {cat.name}
                                  </option>
                                ))}
                            </select>
                          ) : t.category ? (
                            <span className="inline-flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: t.category.color }}
                              />
                              <span>{t.category.name}</span>
                            </span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-slate-400 text-xs">
                          {isEditing ? (
                            <select
                              value={editAccountId}
                              onChange={(e) => setEditAccountId(e.target.value)}
                              className="input-base py-1 px-2 text-xs w-full"
                            >
                              {accounts.map((acc) => (
                                <option key={acc.id} value={acc.id}>
                                  {acc.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            t.accountName
                          )}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {isEditing ? (
                            <select
                              value={editStatus}
                              onChange={(e) => setEditStatus(e.target.value)}
                              className="input-base py-1 px-2 text-xs"
                            >
                              {getSituationOptionsFor(editType).map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <button
                              type="button"
                              onClick={() => toggleSituation(t)}
                              title="Clique para alternar situação"
                              className="cursor-pointer"
                            >
                              {getSituationBadge(t)}
                            </button>
                          )}
                        </td>

                        <td
                          className={`py-3.5 px-4 text-right font-semibold font-mono-nums whitespace-nowrap ${
                            t.type === 'income' ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isEditing ? (
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={editAmount}
                              onChange={(e) => setEditAmount(e.target.value)}
                              className="input-base py-1 px-2 text-xs w-28 text-right"
                            />
                          ) : (
                            `${t.type === 'income' ? '+' : '−'} ${formatMoney(t.amount, privacyMode)}`
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          {isEditing ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => saveEdit(t.id)}
                                title="Salvar"
                                className="p-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 cursor-pointer"
                              >
                                <Check size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                title="Cancelar"
                                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => startEdit(t)}
                                title="Editar transação"
                                aria-label={`Editar ${t.description}`}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-slate-800 transition-colors cursor-pointer"
                              >
                                <Edit3 size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setPendingDelete(t)}
                                title="Excluir transação"
                                aria-label={`Excluir ${t.description}`}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Visão Mobile em Cards Responsivos */}
            <ul className="md:hidden divide-y divide-slate-800/80">
              {filteredTransactions.map((t) => {
                const isEditing = editingId === t.id
                return (
                  <li key={t.id} className="p-4 space-y-3">
                    {isEditing ? (
                      <div className="space-y-2.5">
                        <input
                          type="text"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="input-base w-full"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            className="input-base w-full"
                          />
                          <input
                            type="date"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            className="input-base w-full"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={editType}
                            onChange={(e) => {
                              setEditType(e.target.value)
                              setEditCategoryId('')
                            }}
                            className="input-base w-full"
                          >
                            <option value="expense">Despesa</option>
                            <option value="income">Receita</option>
                          </select>
                          <select
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value)}
                            className="input-base w-full"
                          >
                            {getSituationOptionsFor(editType).map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={editCategoryId}
                            onChange={(e) => setEditCategoryId(e.target.value)}
                            className="input-base w-full"
                          >
                            <option value="">Sem categoria</option>
                            {categories
                              .filter((cat) => cat.type === editType)
                              .map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                  {cat.name}
                                </option>
                              ))}
                          </select>
                          <select
                            value={editAccountId}
                            onChange={(e) => setEditAccountId(e.target.value)}
                            className="input-base w-full"
                          >
                            {accounts.map((acc) => (
                              <option key={acc.id} value={acc.id}>
                                {acc.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-300"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => saveEdit(t.id)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-xs font-semibold text-white"
                          >
                            Salvar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-100 truncate">{t.description}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {formatDateBR(t.date)} · {t.category?.name || 'Sem categoria'} ·{' '}
                              {t.accountName}
                            </p>
                          </div>
                          <span
                            className={`font-bold font-mono-nums text-sm shrink-0 ${
                              t.type === 'income' ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {t.type === 'income' ? '+' : '−'} {formatMoney(t.amount, privacyMode)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <button type="button" onClick={() => toggleSituation(t)}>
                            {getSituationBadge(t)}
                          </button>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(t)}
                              aria-label={`Editar ${t.description}`}
                              className="p-1.5 rounded-lg bg-slate-800/80 text-slate-300"
                            >
                              <Edit3 size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingDelete(t)}
                              aria-label={`Excluir ${t.description}`}
                              className="p-1.5 rounded-lg bg-slate-800/80 text-rose-400"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Excluir transação?"
        description={
          pendingDelete
            ? `Deseja remover "${pendingDelete.description}" (${formatMoney(pendingDelete.amount, privacyMode)})?`
            : ''
        }
        confirmLabel="Excluir"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </main>
  )
}