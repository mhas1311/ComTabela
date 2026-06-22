import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Trash2, Plus, ArrowLeft, Edit3, Check, X } from 'lucide-react'
import Navbar from '../components/Navbar'


export default function Transactions() {
  const { user } = useAuth()
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState('expense')
  const [categoryId, setCategoryId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editDescription, setEditDescription] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editType, setEditType] = useState('expense')
  const [editCategoryId, setEditCategoryId] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editStatus, setEditStatus] = useState('pending')


  const getSituationBadge = (t) => {
    const situation = t.status || null
    const base = 'px-2 py-1 rounded-full text-xs font-medium border'

    if (t.type === 'income') {
      if (situation === 'received') {
        return (
          <span className={base} style={{
            backgroundColor: 'var(--a11y-success-bg)',
            color: 'var(--a11y-success-text)',
            borderColor: 'var(--a11y-success-border)',
          }}>
            ✓ Recebido
          </span>
        )
      }
      return (
        <span className={base} style={{
          backgroundColor: 'var(--a11y-warning-bg)',
          color: 'var(--a11y-warning-text)',
          borderColor: 'var(--a11y-warning-border)',
        }}>
          ○ Pendente
        </span>
      )
    }

    // expense
    if (situation === 'paid') {
      return (
        <span className={base} style={{
          backgroundColor: 'var(--a11y-success-bg)',
          color: 'var(--a11y-success-text)',
          borderColor: 'var(--a11y-success-border)',
        }}>
          ✓ Pago
        </span>
      )
    }

    return (
      <span className={base} style={{
        backgroundColor: 'var(--a11y-danger-bg)',
        color: 'var(--a11y-danger-text)',
        borderColor: 'var(--a11y-danger-border)',
      }}>
        ○ Pendente
      </span>
    )
  }

  const updateTransactionSituation = async (id, newSituation) => {
    const { error } = await supabase
      .from('transactions')
      .update({ status: newSituation })
      .eq('id', id)

    if (error) {
      console.error('Erro ao atualizar situação:', error)
      return
    }

    fetchTransactions()
  }






  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .order('name')
    if (!error) setCategories(data)
  }

  const fetchTransactions = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
    if (error) console.error(error)
    else {
      const enriched = data.map(t => {
        const cat = categories.find(c => c.id === t.category_id)
        return { ...t, category: cat || null }
      })
      setTransactions(enriched)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (user) fetchCategories()
  }, [user])

  useEffect(() => {
    if (user && categories.length >= 0) fetchTransactions()
  }, [categories, user])

  const filteredCategories = categories.filter(cat => cat.type === type)

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!description || !amount) return
    setAdding(true)

    const defaultSituation = type === 'income' ? 'pending' : 'pending'
    // Mapeamento conforme pedido:
    // - Receita: pending/received
    // - Despesa: pending/paid

    const newTransaction = {
      user_id: user.id,
      description,
      amount: parseFloat(amount),
      type,
      category_id: categoryId || null,
      date,
      status: defaultSituation,
    }

    // Debug útil: se houver erro, loga
    const { error } = await supabase.from('transactions').insert(newTransaction)
    if (error) {
      console.error('Erro ao adicionar transação:', error)
    } else {
      setDescription('')
      setAmount('')
      setCategoryId('')
      fetchTransactions()
    }
    setAdding(false)
  }


  const handleDelete = async (id) => {
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (!error) fetchTransactions()
  }

  const formatMoney = (value) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

  const startEdit = (t) => {
    setEditingId(t.id)
    setEditDescription(t.description || '')
    setEditAmount(t.amount != null ? String(t.amount) : '')
    setEditType(t.type || 'expense')
    setEditCategoryId(t.category_id || '')
    setEditDate(t.date || '')
    setEditStatus(t.status || (t.type === 'income' ? 'pending' : 'pending'))
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  const saveEdit = async (id) => {
    if (!editDescription.trim()) return
    if (!editAmount || isNaN(Number(editAmount))) return

    const nextPayload = {
      description: editDescription.trim(),
      amount: parseFloat(editAmount),
      type: editType,
      category_id: editCategoryId ? editCategoryId : null,
      date: editDate || undefined,
      status: editStatus,
    }


    const { error } = await supabase
      .from('transactions')
      .update(nextPayload)
      .eq('id', id)
      .select()
      .single()


    if (error) {
      console.error('Erro ao salvar transação:', error)
      return
    }

    setEditingId(null)
    fetchTransactions()
  }

  const getSituationOptionsFor = (txnType) => {
    const isIncome = txnType === 'income'
    return isIncome
      ? [
          { value: 'pending', label: 'Pendente' },
          { value: 'received', label: 'Recebido' },
        ]
      : [
          { value: 'pending', label: 'Pendente' },
          { value: 'paid', label: 'Pago' },
        ]
  }

  return ( 
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <Navbar
        backTo="/dashboard"
        rightSlot={
          <Link
            to="/categories"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-medium transition-colors text-sm"
          >
            Categorias
          </Link>
        }
      />

      <h1 className="text-3xl font-bold mb-8">Transações</h1>

      {/* Formulário */}
      <form onSubmit={handleAdd} className="bg-gray-900 rounded-xl p-6 mb-8 border border-gray-800">
        {/* conteúdo do formulário mantido igual */}
        <h2 className="text-lg font-semibold mb-4">Nova transação</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <input type="text" placeholder="Descrição" value={description} onChange={(e) => setDescription(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500" required />
          <input type="number" step="0.01" placeholder="Valor" value={amount} onChange={(e) => setAmount(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500" required />
          <select value={type} onChange={(e) => { setType(e.target.value); setCategoryId('') }} className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="expense">Despesa</option>
            <option value="income">Receita</option>
          </select>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">Sem categoria</option>
            {filteredCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <button type="submit" disabled={adding} className="mt-4 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-6 py-2 rounded-lg font-medium transition-colors">
          <Plus size={18} />
          {adding ? 'Adicionando...' : 'Adicionar'}
        </button>
      </form>

      {/* Tabela de transações */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        {loading ? (
          <p className="p-6 text-gray-400">Carregando...</p>
        ) : transactions.length === 0 ? (
          <p className="p-6 text-gray-400">Nenhuma transação ainda.</p>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-800 text-left text-sm text-gray-300">
              <tr>
                <th className="p-4">Data</th>
                <th className="p-4">Descrição</th>
                <th className="p-4">Categoria</th>
                <th className="p-4">Tipo</th>
                <th className="p-4">Situação</th>
                <th className="p-4 text-right">Valor</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-t border-gray-800 hover:bg-gray-800/50">
                  <td className="p-4">{new Date(t.date).toLocaleDateString('pt-BR')}</td>
                  <td className="p-4">
                    {editingId === t.id ? (
                      <input
                        type="text"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      t.description
                    )}
                  </td>

                  <td className="p-4">
                    {editingId === t.id ? (
                      <select
                        value={editCategoryId}
                        onChange={(e) => setEditCategoryId(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Sem categoria</option>
                        {categories
                          .filter((cat) => cat.type === editType)
                          .map((cat) => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                      </select>
                    ) : (
                      (t.category ? (
                        <span className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: t.category.color }} />
                          {t.category.name}
                        </span>
                      ) : '-')
                    )}
                  </td>

                  <td className="p-4">
                    {editingId === t.id ? (
                      <select
                        value={editType}
                        onChange={(e) => {
                          const nextType = e.target.value
                          setEditType(nextType)
                          setEditCategoryId('')
                        }}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="expense">Despesa</option>
                        <option value="income">Receita</option>
                      </select>
                    ) : (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${t.type === 'income' ? 'bg-emerald-900 text-emerald-300' : 'bg-red-900 text-red-300'}`}>
                        {t.type === 'income' ? 'Receita' : 'Despesa'}
                      </span>
                    )}
                  </td>

                  <td className="p-4">
                    {editingId === t.id ? (
                      <select
                        value={editStatus || 'pending'}
                        onChange={(e) => setEditStatus(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {getSituationOptionsFor(editType).map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : (
                      (() => {
                        const situation = t.status || null
                        const isIncome = t.type === 'income'
                        const next = isIncome
                          ? (situation === 'received' ? 'pending' : 'received')
                          : (situation === 'paid' ? 'pending' : 'paid')

                        return (
                          <button
                            type="button"
                            onClick={() => updateTransactionSituation(t.id, next)}
                            className="cursor-pointer"
                            title={isIncome ? 'Recebido/Pendente' : 'Pago/Pendente'}
                          >
                            {getSituationBadge(t)}
                          </button>
                        )
                      })()
                    )}
                  </td>

                  <td className={`p-4 text-right font-medium ${t.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {editingId === t.id ? (
                      <input
                        type="number"
                        step="0.01"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        className="w-32 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      formatMoney(t.amount)
                    )}
                  </td>

                  <td className="p-4">
                    {editingId === t.id ? (
                      <div className="flex items-center gap-2">
                        <button onClick={() => saveEdit(t.id)} className="text-emerald-400 hover:text-emerald-300"><Check size={18} /></button>
                        <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-300"><X size={18} /></button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(t)} className="text-gray-500 hover:text-blue-400 transition-colors">
                        <Edit3 size={18} />
                      </button>
                    )}

                    {editingId !== t.id && (
                      <button onClick={() => handleDelete(t.id)} className="ml-2 text-gray-500 hover:text-red-400 transition-colors">
                        <Trash2 size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}