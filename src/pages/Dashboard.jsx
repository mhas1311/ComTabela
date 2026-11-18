import { useCallback, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ArrowRight,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Landmark,
  PiggyBank,
  Plus,
  PlusCircle,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { useToast } from '../contexts/ToastContext'
import { supabase } from '../lib/supabase'
import {
  currentMonthISO,
  formatDateBR,
  formatMonthFullBR,
  formatMonthShortBR,
  getRecentMonthsISO,
  todayISO,
} from '../lib/date'
import { formatMoney } from '../lib/formatters'
import ExportButton from '../components/ExportButton'
import { PageSkeleton } from '../components/Skeleton'

const ACCOUNT_TYPE_LABELS = {
  checking: 'Conta Bancária',
  cash: 'Carteira Física',
  credit: 'Cartão de Crédito',
  savings: 'Reserva / Investimento',
}

export default function Dashboard() {
  const { user } = useAuth()
  const {
    budget,
    updateBudget,
    operationsEnabled,
    setOperationsEnabled,
    privacyMode,
    accounts,
    addAccount,
    removeAccount,
    categoryBudgets,
    txAccounts,
  } = useWorkspace()
  const { toast } = useToast()

  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(currentMonthISO)
  const [budgetInput, setBudgetInput] = useState('')
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [newAccName, setNewAccName] = useState('')
  const [newAccType, setNewAccType] = useState('checking')
  const [newAccBalance, setNewAccBalance] = useState('')

  useEffect(() => {
    document.title = 'Visão Geral — ComTabela'
  }, [])

  useEffect(() => {
    setBudgetInput(budget > 0 ? String(budget) : '')
  }, [budget])

  const loadData = useCallback(async () => {
    if (!user?.id || !supabase) return
    const [{ data: txRows, error: txErr }, { data: catRows, error: catErr }] = await Promise.all([
      supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false }),
      supabase.from('categories').select('*').eq('user_id', user.id).order('name'),
    ])

    if (txErr || catErr) {
      console.error(txErr || catErr)
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível sincronizar suas transações.',
        variant: 'error',
      })
    }

    const catList = catRows || []
    setCategories(catList)
    setTransactions(
      (txRows || []).map((row) => ({
        ...row,
        category: catList.find((item) => item.id === row.category_id) || null,
      }))
    )
    setLoading(false)
  }, [user?.id, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const enrichedTransactions = useMemo(() => {
    const defaultAcc = accounts[0]
    return transactions.map((row) => {
      const accId = txAccounts[row.id] || defaultAcc?.id
      const acc = accounts.find((a) => a.id === accId) || defaultAcc
      return {
        ...row,
        accountId: acc?.id || '',
        accountName: acc?.name || 'Conta Principal',
      }
    })
  }, [transactions, accounts, txAccounts])

  const monthly = useMemo(
    () => enrichedTransactions.filter((row) => row.date?.startsWith(month)),
    [enrichedTransactions, month]
  )

  const totals = useMemo(
    () =>
      monthly.reduce(
        (acc, row) => {
          const value = Number(row.amount) || 0
          const settled = row.type === 'income' ? row.status === 'received' : row.status === 'paid'
          if (row.type === 'income') {
            acc.incomeForecast += value
            if (settled) acc.incomeActual += value
          } else {
            acc.expenseForecast += value
            if (settled) acc.expenseActual += value
          }
          return acc
        },
        { incomeActual: 0, incomeForecast: 0, expenseActual: 0, expenseForecast: 0 }
      ),
    [monthly]
  )

  // Evolução dos últimos 6 meses até o mês selecionado
  const cashflowSeries = useMemo(() => {
    const months = getRecentMonthsISO(month, 6)
    return months.map((m) => {
      let receitas = 0
      let despesas = 0
      enrichedTransactions.forEach((tx) => {
        if (tx.date?.startsWith(m)) {
          const val = Number(tx.amount) || 0
          if (tx.type === 'income') receitas += val
          else despesas += val
        }
      })
      return {
        monthKey: m,
        label: formatMonthShortBR(m),
        Receitas: Number(receitas.toFixed(2)),
        Despesas: Number(despesas.toFixed(2)),
      }
    })
  }, [enrichedTransactions, month])

  // Distribuição de despesas por categoria no mês selecionado
  const categoryBreakdown = useMemo(() => {
    const map = new Map()
    monthly
      .filter((tx) => tx.type === 'expense')
      .forEach((tx) => {
        const key = tx.category?.id || 'uncategorized'
        const current = map.get(key) || {
          id: key,
          name: tx.category?.name || 'Sem categoria',
          color: tx.category?.color || '#64748b',
          value: 0,
        }
        current.value += Number(tx.amount) || 0
        map.set(key, current)
      })

    const list = Array.from(map.values()).sort((a, b) => b.value - a.value)
    const sum = list.reduce((s, item) => s + item.value, 0)
    return list.map((item) => ({
      ...item,
      value: Number(item.value.toFixed(2)),
      pct: sum > 0 ? (item.value / sum) * 100 : 0,
    }))
  }, [monthly])

  // Metas mensais por categoria
  const categoryBudgetProgress = useMemo(() => {
    return categories
      .filter((cat) => cat.type === 'expense' && Number(categoryBudgets[cat.id]) > 0)
      .map((cat) => {
        const limit = Number(categoryBudgets[cat.id])
        const spent = monthly
          .filter((tx) => tx.type === 'expense' && tx.category_id === cat.id)
          .reduce((s, tx) => s + (Number(tx.amount) || 0), 0)
        return {
          id: cat.id,
          name: cat.name,
          color: cat.color,
          spent,
          limit,
          pct: limit > 0 ? (spent / limit) * 100 : 0,
        }
      })
      .sort((a, b) => b.pct - a.pct)
  }, [categories, categoryBudgets, monthly])

  // Saldos calculados por conta/carteira (considerando lançamentos efetivados)
  const accountBalances = useMemo(() => {
    const defaultAccId = accounts[0]?.id
    return accounts.map((acc) => {
      let delta = 0
      enrichedTransactions.forEach((tx) => {
        const targetAcc = tx.accountId || defaultAccId
        if (targetAcc !== acc.id) return
        const val = Number(tx.amount) || 0
        if (tx.type === 'income' && tx.status === 'received') delta += val
        if (tx.type === 'expense' && tx.status === 'paid') delta -= val
      })
      return {
        ...acc,
        balance: (Number(acc.initialBalance) || 0) + delta,
      }
    })
  }, [accounts, enrichedTransactions])

  // Contas pendentes (atrasadas + próximas a vencer)
  const pendingBills = useMemo(() => {
    const today = todayISO()
    return enrichedTransactions
      .filter((row) => row.type === 'expense' && row.status !== 'paid')
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .slice(0, 6)
      .map((row) => ({
        ...row,
        overdue: Boolean(row.date && row.date < today),
      }))
  }, [enrichedTransactions])

  const budgetPercent = budget > 0 ? (totals.expenseForecast / budget) * 100 : 0

  const handleSaveBudget = (event) => {
    event.preventDefault()
    updateBudget(budgetInput)
    toast({
      title: 'Orçamento mensal salvo',
      description: Number(budgetInput) > 0 ? `Meta definida em ${formatMoney(budgetInput)}.` : 'Meta removida.',
    })
  }

  const handleMarkBillPaid = async (bill) => {
    if (!supabase || !user?.id) return
    const { error } = await supabase
      .from('transactions')
      .update({ status: 'paid' })
      .eq('id', bill.id)
      .eq('user_id', user.id)

    if (error) {
      toast({ title: 'Erro ao atualizar conta', variant: 'error' })
      return
    }
    toast({ title: 'Conta marcada como paga', description: bill.description })
    loadData()
  }

  const handleCreateAccount = (event) => {
    event.preventDefault()
    if (!newAccName.trim()) return
    const palette = ['#10b981', '#0ea5e9', '#f59e0b', '#14b8a6', '#f97316', '#64748b']
    const color = palette[accounts.length % palette.length]
    addAccount({
      name: newAccName,
      type: newAccType,
      initialBalance: Number(newAccBalance) || 0,
      color,
    })
    setNewAccName('')
    setNewAccBalance('')
    setShowAddAccount(false)
    toast({ title: 'Conta adicionada', description: `${newAccName.trim()} pronta para uso.` })
  }

  if (loading) return <PageSkeleton />

  return (
    <main className="space-y-6">
      {/* Cabeçalho */}
      <header className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100">
            Visão Geral
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {formatMonthFullBR(month)} · Realizado separado de valores previstos
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-1.5">
            <CalendarClock size={16} className="text-emerald-400 shrink-0" />
            <input
              id="dashboard-month-picker"
              aria-label="Selecionar mês"
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="bg-transparent text-sm text-slate-100 focus:outline-none cursor-pointer"
            />
          </div>
          <ExportButton transactions={monthly} filePrefix={`comtabela_${month}`} />
          <Link
            id="btn-dashboard-new-tx"
            to="/transactions"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            <PlusCircle size={16} />
            <span>Nova transação</span>
          </Link>
        </div>
      </header>

      {/* Métricas principais */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          icon={<Wallet size={19} />}
          label="Saldo realizado no mês"
          value={formatMoney(totals.incomeActual - totals.expenseActual, privacyMode)}
          detail={`Previsto líquido: ${formatMoney(totals.incomeForecast - totals.expenseForecast, privacyMode)}`}
          tone="sky"
        />
        <MetricCard
          icon={<TrendingUp size={19} />}
          label="Receitas recebidas"
          value={formatMoney(totals.incomeActual, privacyMode)}
          detail={`Previsto no mês: ${formatMoney(totals.incomeForecast, privacyMode)}`}
          tone="emerald"
        />
        <MetricCard
          icon={<TrendingDown size={19} />}
          label="Despesas pagas"
          value={formatMoney(totals.expenseActual, privacyMode)}
          detail={`Previsto no mês: ${formatMoney(totals.expenseForecast, privacyMode)}`}
          tone="rose"
        />
      </section>

      {/* Gráficos interativos */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 surface-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                Fluxo de caixa (6 meses)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Comparativo mensal entre receitas e despesas registradas
              </p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashflowSeries} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => (privacyMode ? '•••' : `R$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`)}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(148, 163, 184, 0.06)' }}
                  contentStyle={{
                    backgroundColor: '#0f1623',
                    borderColor: 'rgba(148,163,184,0.2)',
                    borderRadius: '0.75rem',
                    color: '#f1f5f9',
                    fontSize: '12px',
                  }}
                  formatter={(val) => formatMoney(val, privacyMode)}
                />
                <Bar dataKey="Receitas" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={28} />
                <Bar dataKey="Despesas" fill="#f43f5e" radius={[6, 6, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-2 surface-card p-6 flex flex-col">
          <div className="mb-3">
            <h2 className="text-base font-semibold text-slate-100">Despesas por categoria</h2>
            <p className="text-xs text-slate-400 mt-0.5">Distribuição de gastos em {formatMonthFullBR(month)}</p>
          </div>

          {categoryBreakdown.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
              <p className="text-sm text-slate-400">Sem despesas registradas neste mês.</p>
              <Link
                to="/transactions"
                className="mt-3 text-xs font-semibold text-emerald-400 hover:text-emerald-300"
              >
                Adicionar primeira despesa
              </Link>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-between gap-4">
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryBreakdown}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={72}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {categoryBreakdown.map((entry) => (
                        <Cell key={entry.id} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f1623',
                        borderColor: 'rgba(148,163,184,0.2)',
                        borderRadius: '0.75rem',
                        color: '#f1f5f9',
                        fontSize: '12px',
                      }}
                      formatter={(val) => formatMoney(val, privacyMode)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <ul className="space-y-2 max-h-36 overflow-y-auto pr-1">
                {categoryBreakdown.slice(0, 5).map((item) => (
                  <li key={item.id} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="truncate text-slate-200">{item.name}</span>
                    </span>
                    <span className="font-mono-nums text-slate-300 shrink-0 ml-2">
                      {formatMoney(item.value, privacyMode)}{' '}
                      <span className="text-slate-500">({item.pct.toFixed(0)}%)</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* Contas / Carteiras */}
      <section className="surface-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <Landmark size={19} className="text-sky-400" />
            <div>
              <h2 className="text-base font-semibold text-slate-100">Contas e carteiras</h2>
              <p className="text-xs text-slate-400">
                Saldo consolidado por conta (saldo inicial + entradas recebidas − saídas pagas)
              </p>
            </div>
          </div>
          <button
            type="button"
            id="btn-toggle-add-account"
            onClick={() => setShowAddAccount((prev) => !prev)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer self-start sm:self-auto"
          >
            <Plus size={14} />
            <span>Nova conta</span>
          </button>
        </div>

        {showAddAccount && (
          <form
            onSubmit={handleCreateAccount}
            className="mb-5 p-4 surface-elevated grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
          >
            <div>
              <label htmlFor="new-acc-name" className="block text-xs text-slate-400 mb-1">
                Nome da conta
              </label>
              <input
                id="new-acc-name"
                type="text"
                required
                placeholder="Ex.: Nubank, Itaú..."
                value={newAccName}
                onChange={(e) => setNewAccName(e.target.value)}
                className="input-base w-full"
              />
            </div>
            <div>
              <label htmlFor="new-acc-type" className="block text-xs text-slate-400 mb-1">
                Tipo
              </label>
              <select
                id="new-acc-type"
                value={newAccType}
                onChange={(e) => setNewAccType(e.target.value)}
                className="input-base w-full"
              >
                {Object.entries(ACCOUNT_TYPE_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="new-acc-balance" className="block text-xs text-slate-400 mb-1">
                Saldo inicial (R$)
              </label>
              <input
                id="new-acc-balance"
                type="number"
                step="0.01"
                placeholder="0,00"
                value={newAccBalance}
                onChange={(e) => setNewAccBalance(e.target.value)}
                className="input-base w-full"
              />
            </div>
            <button
              type="submit"
              id="btn-save-account"
              className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              Adicionar
            </button>
          </form>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {accountBalances.map((acc) => (
            <div
              key={acc.id}
              className="surface-elevated p-4 flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <CreditCard size={15} style={{ color: acc.color || '#10b981' }} />
                  <span className="text-sm font-semibold text-slate-100 truncate">{acc.name}</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {ACCOUNT_TYPE_LABELS[acc.type] || 'Conta'}
                </p>
                <p
                  className={`text-lg font-bold font-mono-nums mt-2 ${
                    acc.balance < 0 ? 'text-rose-400' : 'text-slate-100'
                  }`}
                >
                  {formatMoney(acc.balance, privacyMode)}
                </p>
              </div>
              {accounts.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    removeAccount(acc.id)
                    toast({ title: 'Conta removida', description: acc.name, variant: 'info' })
                  }}
                  title="Remover conta"
                  aria-label={`Remover conta ${acc.name}`}
                  className="text-slate-500 hover:text-rose-400 p-1 transition-colors cursor-pointer"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Orçamento Mensal + Contas Pendentes */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="surface-card p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <PiggyBank size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">Orçamento mensal e metas</h2>
              <p className="text-xs text-slate-400">Limite global e tetos por categoria</p>
            </div>
          </div>

          <form onSubmit={handleSaveBudget} className="flex gap-2.5">
            <input
              id="input-monthly-budget"
              type="number"
              min="0"
              step="0.01"
              value={budgetInput}
              onChange={(event) => setBudgetInput(event.target.value)}
              placeholder="Meta global do mês (ex.: 3500)"
              className="input-base min-w-0 flex-1"
            />
            <button
              type="submit"
              id="btn-save-budget"
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm px-4 rounded-xl transition-colors cursor-pointer"
            >
              Salvar
            </button>
          </form>

          {budget > 0 && (
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-300">
                  Planejado no mês:{' '}
                  <strong className="font-mono-nums">
                    {formatMoney(totals.expenseForecast, privacyMode)}
                  </strong>{' '}
                  de {formatMoney(budget, privacyMode)}
                </span>
                <span
                  className={`font-mono-nums font-semibold ${
                    budgetPercent > 100
                      ? 'text-rose-400'
                      : budgetPercent >= 80
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                  }`}
                >
                  {budgetPercent.toFixed(0)}%
                </span>
              </div>
              <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    budgetPercent > 100
                      ? 'bg-rose-500'
                      : budgetPercent >= 80
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(budgetPercent, 100)}%` }}
                />
              </div>
            </div>
          )}

          {categoryBudgetProgress.length > 0 ? (
            <div className="pt-3 border-t border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">Tetos por categoria</span>
                <Link to="/categories" className="text-xs text-emerald-400 hover:text-emerald-300">
                  Ajustar metas
                </Link>
              </div>
              {categoryBudgetProgress.map((item) => (
                <div key={item.id} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="flex items-center gap-2 text-slate-200">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      {item.name}
                    </span>
                    <span className="font-mono-nums text-slate-400">
                      {formatMoney(item.spent, privacyMode)} / {formatMoney(item.limit, privacyMode)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        item.pct > 100
                          ? 'bg-rose-500'
                          : item.pct >= 80
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(item.pct, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Você também pode definir tetos individuais por categoria na tela de{' '}
              <Link to="/categories" className="text-emerald-400 hover:underline">
                Categorias
              </Link>
              .
            </p>
          )}
        </div>

        <div className="surface-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-100">Contas pendentes</h2>
                <p className="text-xs text-slate-400">Despesas em aberto ordenadas por vencimento</p>
              </div>
            </div>

            {pendingBills.length > 0 ? (
              <ul className="divide-y divide-slate-800/80">
                {pendingBills.map((bill) => (
                  <li key={bill.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-100 truncate">
                          {bill.description}
                        </p>
                        {bill.overdue && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-950/90 text-rose-300 border border-rose-800/70 shrink-0">
                            Atrasada
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {formatDateBR(bill.date)} · {bill.category?.name || 'Sem categoria'} ·{' '}
                        {bill.accountName}
                      </p>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="text-sm font-semibold font-mono-nums text-rose-400">
                        {formatMoney(bill.amount, privacyMode)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleMarkBillPaid(bill)}
                        title="Marcar como paga"
                        aria-label={`Marcar ${bill.description} como paga`}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-emerald-600/20 text-slate-400 hover:text-emerald-300 border border-slate-700/80 transition-colors cursor-pointer"
                      >
                        <CheckCircle2 size={15} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-10 text-center">
                <p className="text-sm text-slate-400">Nenhuma despesa pendente no momento.</p>
              </div>
            )}
          </div>

          <Link
            to="/transactions"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-400 hover:text-emerald-300 mt-4"
          >
            <span>Gerenciar todas as transações</span>
            <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      {/* Módulo Operações */}
      <section className="surface-card p-6 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Briefcase size={19} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-100">Capital Operacional</h2>
            <p className="text-sm text-slate-400 mt-0.5">
              Banca EV+, diário de entradas e estoque de revenda separados do orçamento doméstico.
            </p>
          </div>
        </div>
        {operationsEnabled ? (
          <Link
            to="/operations"
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl text-center transition-colors shrink-0"
          >
            Abrir Operações
          </Link>
        ) : (
          <button
            type="button"
            id="btn-enable-operations"
            onClick={() => {
              setOperationsEnabled(true)
              toast({ title: 'Módulo Operações ativado' })
            }}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer shrink-0"
          >
            Ativar Operações
          </button>
        )}
      </section>
    </main>
  )
}

function MetricCard({ icon, label, value, detail, tone }) {
  const styles = {
    sky: 'text-sky-400 bg-sky-500/10 border-sky-500/25',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
    rose: 'text-rose-400 bg-rose-500/10 border-rose-500/25',
  }
  const textTone = {
    sky: 'text-sky-400',
    emerald: 'text-emerald-400',
    rose: 'text-rose-400',
  }

  return (
    <div className="surface-card p-6">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${styles[tone]}`}>
          {icon}
        </div>
        <span className="text-sm font-medium text-slate-300">{label}</span>
      </div>
      <p className={`text-2xl font-bold font-mono-nums mt-4 ${textTone[tone]}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-1.5 font-mono-nums">{detail}</p>
    </div>
  )
}

MetricCard.propTypes = {
  icon: PropTypes.node.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  detail: PropTypes.string.isRequired,
  tone: PropTypes.oneOf(['sky', 'emerald', 'rose']).isRequired,
}
