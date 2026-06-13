import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { ArrowRight, TrendingUp, TrendingDown, DollarSign, PlusCircle, Tags } from 'lucide-react'
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import ExportButton from '../components/ExportButton'

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

export default function Dashboard() {
  const { signOut, user } = useAuth()
  const [totalIncome, setTotalIncome] = useState(0)
  const [totalExpense, setTotalExpense] = useState(0)
  const [transactions, setTransactions] = useState([])
  const [pieData, setPieData] = useState([])
  const [barData, setBarData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    const fetchData = async () => {
      const { data: txData, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })

      if (error) {
        console.error(error)
        setLoading(false)
        return
      }

      const { data: catData } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)

      const categories = catData || []
      const enriched = txData.map(t => ({
        ...t,
        category: categories.find(c => c.id === t.category_id) || null
      }))

      setTransactions(enriched)

      const incomeTotal = enriched
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0)
      const expenseTotal = enriched
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0)
      setTotalIncome(incomeTotal)
      setTotalExpense(expenseTotal)

      const expensesByCategory = enriched
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => {
          const catName = t.category?.name || 'Sem categoria'
          const existing = acc.find(item => item.name === catName)
          if (existing) {
            existing.value += parseFloat(t.amount)
          } else {
            acc.push({ name: catName, value: parseFloat(t.amount), color: t.category?.color })
          }
          return acc
        }, [])
      setPieData(expensesByCategory)

      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
      const today = new Date()
      const monthlyData = {}
      for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
        const key = `${months[d.getMonth()]}/${d.getFullYear()}`
        monthlyData[key] = { name: key, Receitas: 0, Despesas: 0 }
      }

      enriched.forEach(t => {
        const d = new Date(t.date)
        const key = `${months[d.getMonth()]}/${d.getFullYear()}`
        if (monthlyData[key]) {
          if (t.type === 'income') monthlyData[key].Receitas += parseFloat(t.amount)
          else monthlyData[key].Despesas += parseFloat(t.amount)
        }
      })
      setBarData(Object.values(monthlyData))

      setLoading(false)
    }

    fetchData()
  }, [user])

  const formatMoney = (value) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

  const balance = totalIncome - totalExpense

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 shadow-2xl">
          <div className="flex items-center gap-2 mb-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: data.color || COLORS[0] }}
            />
            <span className="text-white font-medium">{data.name}</span>
          </div>
          <p className="text-gray-300 text-sm">
            Valor: <span className="text-emerald-400 font-semibold">{formatMoney(data.value)}</span>
          </p>
          {totalExpense > 0 && (
            <p className="text-gray-400 text-xs mt-1">
              {((data.value / totalExpense) * 100).toFixed(1)}% do total
            </p>
          )}
        </div>
      )
    }
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white text-lg">
        Carregando ComTabela...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      {/* Cabeçalho */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">ComTabela 📊</h1>
        <div className="flex items-center gap-4">
          <ExportButton transactions={transactions} />
          <button onClick={signOut} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
            Sair
          </button>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-emerald-900 p-2 rounded-lg"><TrendingUp size={20} className="text-emerald-400" /></div>
            <span className="text-gray-400">Receitas</span>
          </div>
          <p className="text-2xl font-bold text-emerald-400">{formatMoney(totalIncome)}</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-red-900 p-2 rounded-lg"><TrendingDown size={20} className="text-red-400" /></div>
            <span className="text-gray-400">Despesas</span>
          </div>
          <p className="text-2xl font-bold text-red-400">{formatMoney(totalExpense)}</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-blue-900 p-2 rounded-lg"><DollarSign size={20} className="text-blue-400" /></div>
            <span className="text-gray-400">Saldo</span>
          </div>
          <p className={`text-2xl font-bold ${balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatMoney(balance)}
          </p>
        </div>
      </div>

      {/* Cards de Acesso Rápido - ONDE O USUÁRIO COMEÇA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Link
          to="/transactions"
          className="bg-emerald-600 hover:bg-emerald-700 rounded-xl p-6 transition-all group shadow-lg shadow-emerald-900/20"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <PlusCircle size={24} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">Transações</h2>
          </div>
          <p className="text-emerald-100 mb-4">Registre suas receitas e despesas</p>
          <span className="inline-flex items-center gap-1 text-white font-medium group-hover:gap-2 transition-all">
            Começar <ArrowRight size={18} />
          </span>
        </Link>

        <Link
          to="/categories"
          className="bg-blue-600 hover:bg-blue-700 rounded-xl p-6 transition-all group shadow-lg shadow-blue-900/20"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <Tags size={24} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">Categorias</h2>
          </div>
          <p className="text-blue-100 mb-4">Organize suas finanças por categoria</p>
          <span className="inline-flex items-center gap-1 text-white font-medium group-hover:gap-2 transition-all">
            Personalizar <ArrowRight size={18} />
          </span>
        </Link>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Donut - Despesas por Categoria */}
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h2 className="text-lg font-semibold mb-4">Despesas por Categoria</h2>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={120}
                  paddingAngle={3}
                  cornerRadius={8}
                  stroke="#1f2937"
                  strokeWidth={2}
                  animationBegin={0}
                  animationDuration={800}
                  animationEasing="ease-out"
                >
                  {pieData.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={entry.color || COLORS[index % COLORS.length]}
                      style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle" className="fill-white text-xl font-bold">
                  {formatMoney(totalExpense)}
                </text>
                <text x="50%" y="56%" textAnchor="middle" dominantBaseline="middle" className="fill-gray-400 text-sm">
                  Total de Despesas
                </text>
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 py-8 text-center">Nenhuma despesa registrada.</p>
          )}
        </div>

        {/* Barras - Evolução Mensal */}
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h2 className="text-lg font-semibold mb-4">Evolução Mensal</h2>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip formatter={(value) => formatMoney(value)} />
                <Bar dataKey="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 py-8 text-center">Nenhum dado mensal.</p>
          )}
        </div>
      </div>

      {/* Últimas transações */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold mb-4">Últimas Transações</h2>
        {transactions.length > 0 ? (
          <ul className="space-y-3">
            {transactions.slice(0, 5).map(t => (
              <li key={t.id} className="flex justify-between items-center border-b border-gray-800 pb-2">
                <div>
                  <p className="font-medium">{t.description}</p>
                  <p className="text-sm text-gray-400">
                    {new Date(t.date).toLocaleDateString('pt-BR')} • {t.category?.name || 'Sem categoria'}
                  </p>
                </div>
                <span className={t.type === 'income' ? 'text-emerald-400' : 'text-red-400'}>
                  {t.type === 'income' ? '+' : '-'}{formatMoney(t.amount)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-400">Nenhuma transação.</p>
        )}
        <Link to="/transactions" className="flex items-center gap-2 text-emerald-400 mt-4 hover:underline">
          Ver todas <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  )
}