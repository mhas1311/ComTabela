import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { ArrowRight, CalendarClock, PiggyBank, PlusCircle, Tags, TrendingDown, TrendingUp, WalletCards } from 'lucide-react'
import ExportButton from '../components/ExportButton'

const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)
const dateToday = () => new Date().toISOString().slice(0, 10)

export default function Dashboard() {
  const { signOut, user } = useAuth()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [budget, setBudget] = useState(() => localStorage.getItem('comtabela-budget') || '')
  const [operations, setOperations] = useState(() => localStorage.getItem('comtabela-operations') === 'true')

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const [{ data: rows, error }, { data: categories }] = await Promise.all([
        supabase.from('transactions').select('*').eq('user_id', user.id).order('date', { ascending: false }),
        supabase.from('categories').select('*').eq('user_id', user.id),
      ])
      if (error) console.error(error)
      const list = categories || []
      setTransactions((rows || []).map((row) => ({ ...row, category: list.find((item) => item.id === row.category_id) })))
      setLoading(false)
    }
    load()
  }, [user])

  const monthly = useMemo(() => transactions.filter((row) => row.date?.startsWith(month)), [transactions, month])
  const totals = useMemo(() => monthly.reduce((total, row) => {
    const value = Number(row.amount) || 0
    const paid = row.type === 'income' ? row.status === 'received' : row.status === 'paid'
    if (row.type === 'income') { total.incomeForecast += value; if (paid) total.incomeActual += value }
    else { total.expenseForecast += value; if (paid) total.expenseActual += value }
    return total
  }, { incomeActual: 0, incomeForecast: 0, expenseActual: 0, expenseForecast: 0 }), [monthly])
  const bills = useMemo(() => transactions.filter((row) => row.type === 'expense' && row.status !== 'paid' && row.date >= dateToday()).slice(0, 5), [transactions])
  const budgetValue = Number(budget) || 0
  const budgetPercent = budgetValue ? (totals.expenseForecast / budgetValue) * 100 : 0

  const saveBudget = (event) => { event.preventDefault(); localStorage.setItem('comtabela-budget', budget) }
  const enableOperations = () => { localStorage.setItem('comtabela-operations', 'true'); setOperations(true) }
  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">Carregando ComTabela...</div>

  return <main className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
    <header className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-8"><div><h1 className="text-3xl font-bold">ComTabela</h1><p className="text-gray-400 mt-1">Seu mês, seu dinheiro, suas decisões.</p></div><div className="flex gap-3"><ExportButton transactions={monthly} /><button onClick={signOut} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg">Sair</button></div></header>
    <section className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6 flex flex-col gap-3 md:flex-row md:justify-between md:items-center"><div className="flex gap-3"><CalendarClock className="text-emerald-400" /><div><p className="font-semibold">Visão mensal</p><p className="text-sm text-gray-400">Realizado separado de valores previstos.</p></div></div><input aria-label="Mês" type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2" /></section>
    <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6"><Metric icon={<WalletCards />} label="Saldo disponível" value={money(totals.incomeActual - totals.expenseActual)} detail="Recebido menos pago" color="text-blue-400" /><Metric icon={<TrendingUp />} label="Receitas" value={money(totals.incomeActual)} detail={`${money(totals.incomeForecast)} previsto`} color="text-emerald-400" /><Metric icon={<TrendingDown />} label="Despesas" value={money(totals.expenseActual)} detail={`${money(totals.expenseForecast)} previsto`} color="text-red-400" /></section>
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6"><div className="bg-gray-900 border border-gray-800 rounded-xl p-6"><div className="flex gap-3 items-center mb-4"><PiggyBank className="text-amber-400" /><div><h2 className="font-semibold text-lg">Orçamento mensal</h2><p className="text-sm text-gray-400">Meta pessoal de gastos.</p></div></div><form onSubmit={saveBudget} className="flex gap-2"><input type="number" min="0" step="0.01" value={budget} onChange={(event) => setBudget(event.target.value)} placeholder="Ex.: 2500" className="min-w-0 flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2" /><button className="bg-amber-500 text-gray-950 px-4 rounded-lg">Salvar</button></form>{budgetValue > 0 && <><div className="flex justify-between text-sm mt-4"><span>{money(totals.expenseForecast)} planejado</span><span>{budgetPercent.toFixed(0)}%</span></div><div className="h-3 bg-gray-800 rounded-full mt-2 overflow-hidden"><div className={budgetPercent > 100 ? 'h-full bg-red-500' : 'h-full bg-emerald-500'} style={{ width: `${Math.min(budgetPercent, 100)}%` }} /></div></>}</div><div className="bg-gray-900 border border-gray-800 rounded-xl p-6"><h2 className="font-semibold text-lg mb-4">Contas a vencer</h2>{bills.length ? <ul className="space-y-3">{bills.map((row) => <li key={row.id} className="flex justify-between border-b border-gray-800 pb-3"><div><p>{row.description}</p><p className="text-sm text-gray-400">{new Date(`${row.date}T12:00:00`).toLocaleDateString('pt-BR')} · {row.category?.name || 'Sem categoria'}</p></div><span className="text-red-400">{money(row.amount)}</span></li>)}</ul> : <p className="text-gray-400">Nenhuma conta pendente.</p>}<Link to="/transactions" className="inline-flex gap-2 text-emerald-400 mt-4">Ver transações <ArrowRight size={16} /></Link></div></section>
    <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6"><Link to="/transactions" className="bg-emerald-600 hover:bg-emerald-700 rounded-xl p-6"><PlusCircle className="mb-3" /><h2 className="text-xl font-bold">Registrar transação</h2><p className="text-emerald-100 mt-1">Registre salário, contas e gastos.</p></Link><Link to="/categories" className="bg-blue-600 hover:bg-blue-700 rounded-xl p-6"><Tags className="mb-3" /><h2 className="text-xl font-bold">Organizar categorias</h2><p className="text-blue-100 mt-1">Entenda onde seu dinheiro vai.</p></Link></section>
    <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center"><div><p className="text-emerald-400 text-sm">Módulo opcional</p><h2 className="text-xl font-bold">Operações</h2><p className="text-gray-400 mt-1">Banca, estoque e caixa operacional ficam separados das finanças pessoais.</p></div>{operations ? <Link to="/operations" className="bg-emerald-600 px-5 py-3 rounded-lg text-center">Abrir operações</Link> : <button onClick={enableOperations} className="bg-gray-800 border border-gray-700 px-5 py-3 rounded-lg">Ativar operações</button>}</section>
  </main>
}

function Metric({ icon, label, value, detail, color }) { return <div className="bg-gray-900 border border-gray-800 rounded-xl p-6"><div className={`flex gap-3 ${color}`}>{icon}<span className="text-gray-400">{label}</span></div><p className={`text-2xl font-bold mt-3 ${color}`}>{value}</p><p className="text-sm text-gray-500 mt-1">{detail}</p></div> }
