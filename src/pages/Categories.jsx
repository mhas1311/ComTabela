import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Edit3, Plus, Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { useToast } from '../contexts/ToastContext'
import { currentMonthISO } from '../lib/date'
import { formatMoney } from '../lib/formatters'
import ConfirmDialog from '../components/ConfirmDialog'
import { PageSkeleton } from '../components/Skeleton'

const DEFAULT_CATEGORIES = [
  { name: 'Alimentação', type: 'expense', color: '#f97316' },
  { name: 'Contas', type: 'expense', color: '#f43f5e' },
  { name: 'Transporte', type: 'expense', color: '#0ea5e9' },
  { name: 'Compras', type: 'expense', color: '#eab308' },
  { name: 'Saúde', type: 'expense', color: '#14b8a6' },
  { name: 'Lazer', type: 'expense', color: '#f59e0b' },
  { name: 'Trabalho', type: 'income', color: '#10b981' },
]

// Paleta curada sem tons roxos/violetas em fundo escuro
const COLOR_OPTIONS = [
  '#10b981',
  '#14b8a6',
  '#06b6d4',
  '#0ea5e9',
  '#2563eb',
  '#65a30d',
  '#eab308',
  '#f59e0b',
  '#f97316',
  '#ef4444',
  '#f43f5e',
  '#64748b',
]

export default function Categories() {
  const { user } = useAuth()
  const { categoryBudgets, setCategoryBudget, privacyMode } = useWorkspace()
  const { toast } = useToast()

  const [categories, setCategories] = useState([])
  const [monthlySpendByCat, setMonthlySpendByCat] = useState({})
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState('all')

  // Novo cadastro
  const [name, setName] = useState('')
  const [type, setType] = useState('expense')
  const [color, setColor] = useState('#10b981')
  const [budgetLimit, setBudgetLimit] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Edição
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('#10b981')
  const [editBudget, setEditBudget] = useState('')

  // Confirmação de exclusão
  const [pendingDelete, setPendingDelete] = useState(null)

  useEffect(() => {
    document.title = 'Categorias — ComTabela'
  }, [])

  const fetchCategoriesAndSpend = useCallback(async () => {
    if (!user?.id || !supabase) return
    const monthPrefix = currentMonthISO()

    const [{ data: catData, error: catErr }, { data: txData }] = await Promise.all([
      supabase.from('categories').select('*').eq('user_id', user.id).order('name'),
      supabase
        .from('transactions')
        .select('category_id, amount, type, date')
        .eq('user_id', user.id)
        .eq('type', 'expense'),
    ])

    if (catErr) {
      console.error(catErr)
      toast({ title: 'Erro ao buscar categorias', variant: 'error' })
    } else {
      setCategories(catData || [])
    }

    const spendMap = {}
    ;(txData || []).forEach((tx) => {
      if (tx.date?.startsWith(monthPrefix) && tx.category_id) {
        spendMap[tx.category_id] = (spendMap[tx.category_id] || 0) + (Number(tx.amount) || 0)
      }
    })
    setMonthlySpendByCat(spendMap)
    setLoading(false)
  }, [user?.id, toast])

  useEffect(() => {
    if (!user?.id || !supabase) return

    const ensureDefaultsAndLoad = async () => {
      const normalize = (v) => String(v || '').trim().toLowerCase()
      const { data: existing, error: existingErr } = await supabase
        .from('categories')
        .select('name,type')
        .eq('user_id', user.id)

      if (!existingErr) {
        const existingSet = new Set(
          (existing || []).map((c) => `${normalize(c.name)}::${normalize(c.type)}`)
        )
        const missing = DEFAULT_CATEGORIES.filter(
          (c) => !existingSet.has(`${normalize(c.name)}::${normalize(c.type)}`)
        )
        if (missing.length > 0) {
          await supabase.from('categories').insert(
            missing.map((c) => ({
              user_id: user.id,
              name: c.name,
              type: c.type,
              color: c.color,
            }))
          )
        }
      }
      await fetchCategoriesAndSpend()
    }

    ensureDefaultsAndLoad()
  }, [user?.id, fetchCategoriesAndSpend])

  const filteredCategories = useMemo(() => {
    if (filterType === 'all') return categories
    return categories.filter((c) => c.type === filterType)
  }, [categories, filterType])

  const handleAdd = async (e) => {
    e.preventDefault()
    const cleanName = name.trim()
    if (!cleanName || !supabase || !user?.id) return

    const categoryType = type.toLowerCase()
    const duplicate = categories.some(
      (c) => c.name.trim().toLowerCase() === cleanName.toLowerCase() && c.type === categoryType
    )
    if (duplicate) {
      toast({
        title: 'Categoria já existente',
        description: `Já existe "${cleanName}" para ${categoryType === 'income' ? 'receitas' : 'despesas'}.`,
        variant: 'info',
      })
      return
    }

    setSubmitting(true)
    const { data, error } = await supabase
      .from('categories')
      .insert({
        user_id: user.id,
        name: cleanName,
        type: categoryType,
        color,
      })
      .select()
      .single()
    setSubmitting(false)

    if (error) {
      console.error(error)
      toast({ title: 'Não foi possível criar a categoria', variant: 'error' })
      return
    }

    if (categoryType === 'expense' && Number(budgetLimit) > 0 && data?.id) {
      setCategoryBudget(data.id, Number(budgetLimit))
    }

    setName('')
    setBudgetLimit('')
    toast({ title: 'Categoria adicionada', description: cleanName })
    fetchCategoriesAndSpend()
  }

  const startEdit = (cat) => {
    setEditingId(cat.id)
    setEditName(cat.name)
    setEditColor(cat.color || '#10b981')
    setEditBudget(categoryBudgets[cat.id] ? String(categoryBudgets[cat.id]) : '')
  }

  const cancelEdit = () => setEditingId(null)

  const saveEdit = async (cat) => {
    const cleanName = editName.trim()
    if (!cleanName || !supabase || !user?.id) return

    const { error } = await supabase
      .from('categories')
      .update({ name: cleanName, color: editColor })
      .eq('id', cat.id)
      .eq('user_id', user.id)

    if (error) {
      toast({ title: 'Erro ao atualizar categoria', variant: 'error' })
      return
    }

    if (cat.type === 'expense') {
      setCategoryBudget(cat.id, Number(editBudget) || 0)
    }

    setEditingId(null)
    toast({ title: 'Categoria atualizada', description: cleanName })
    fetchCategoriesAndSpend()
  }

  const confirmDelete = async () => {
    const target = pendingDelete
    setPendingDelete(null)
    if (!target || !supabase || !user?.id) return

    const prevBudget = categoryBudgets[target.id]
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', target.id)
      .eq('user_id', user.id)

    if (error) {
      toast({ title: 'Erro ao excluir categoria', variant: 'error' })
      return
    }

    if (prevBudget) setCategoryBudget(target.id, 0)
    fetchCategoriesAndSpend()

    toast({
      title: 'Categoria excluída',
      description: target.name,
      actionLabel: 'Desfazer',
      onAction: async () => {
        const { data } = await supabase
          .from('categories')
          .insert({
            user_id: user.id,
            name: target.name,
            type: target.type,
            color: target.color,
          })
          .select()
          .single()
        if (data?.id && prevBudget) {
          setCategoryBudget(data.id, prevBudget)
        }
        fetchCategoriesAndSpend()
      },
    })
  }

  if (loading) return <PageSkeleton cards={2} rows={6} />

  return (
    <main className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100">
            Categorias e Metas
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Classifique lançamentos e defina tetos mensais por categoria de despesa
          </p>
        </div>

        <div className="inline-flex bg-slate-900 border border-slate-800 rounded-xl p-1 self-start sm:self-auto">
          {[
            ['all', 'Todas'],
            ['expense', 'Despesas'],
            ['income', 'Receitas'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              id={`btn-filter-cat-${key}`}
              onClick={() => setFilterType(key)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                filterType === key
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* Formulário Nova Categoria */}
      <form onSubmit={handleAdd} className="surface-card p-6 space-y-4">
        <h2 className="text-base font-semibold text-slate-100">Nova categoria</h2>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-4">
            <label htmlFor="cat-name" className="block text-xs font-medium text-slate-300 mb-1.5">
              Nome
            </label>
            <input
              id="cat-name"
              type="text"
              placeholder="Ex.: Educação, Assinaturas..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-base w-full"
              required
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="cat-type" className="block text-xs font-medium text-slate-300 mb-1.5">
              Tipo
            </label>
            <select
              id="cat-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="input-base w-full"
            >
              <option value="expense">Despesa</option>
              <option value="income">Receita</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <label htmlFor="cat-budget" className="block text-xs font-medium text-slate-300 mb-1.5">
              Teto mensal opcional (R$)
            </label>
            <input
              id="cat-budget"
              type="number"
              min="0"
              step="0.01"
              disabled={type !== 'expense'}
              placeholder={type === 'expense' ? 'Ex.: 800,00' : 'Apenas p/ despesas'}
              value={type === 'expense' ? budgetLimit : ''}
              onChange={(e) => setBudgetLimit(e.target.value)}
              className="input-base w-full disabled:opacity-50"
            />
          </div>

          <div className="md:col-span-3">
            <span className="block text-xs font-medium text-slate-300 mb-1.5">Cor identificadora</span>
            <div className="flex flex-wrap gap-1.5 items-center">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Selecionar cor ${c}`}
                  className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                    color === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <label
                className="relative w-6 h-6 rounded-full border border-slate-600 cursor-pointer overflow-hidden"
                title="Cor personalizada"
                style={{ backgroundColor: color }}
              >
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  aria-label="Seletor de cor personalizada"
                />
              </label>
            </div>
          </div>
        </div>

        <button
          type="submit"
          id="btn-add-category"
          disabled={submitting}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer"
        >
          <Plus size={16} />
          <span>{submitting ? 'Salvando...' : 'Adicionar categoria'}</span>
        </button>
      </form>

      {/* Lista de Categorias */}
      <section className="surface-card overflow-hidden">
        {filteredCategories.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">
            Nenhuma categoria encontrada para o filtro selecionado.
          </div>
        ) : (
          <ul className="divide-y divide-slate-800/80">
            {filteredCategories.map((cat) => {
              const isEditing = editingId === cat.id
              const limit = Number(categoryBudgets[cat.id]) || 0
              const spent = monthlySpendByCat[cat.id] || 0
              const pct = limit > 0 ? (spent / limit) * 100 : 0

              return (
                <li
                  key={cat.id}
                  className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:bg-slate-900/50 transition-colors"
                >
                  {isEditing ? (
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={editColor}
                          onChange={(e) => setEditColor(e.target.value)}
                          className="w-8 h-8 rounded cursor-pointer bg-transparent"
                          aria-label="Cor da categoria"
                        />
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="input-base flex-1"
                        />
                      </div>
                      {cat.type === 'expense' ? (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Teto mensal (R$)"
                          value={editBudget}
                          onChange={(e) => setEditBudget(e.target.value)}
                          className="input-base"
                        />
                      ) : (
                        <span className="text-xs text-slate-500">Categoria de receita</span>
                      )}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => saveEdit(cat)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer"
                        >
                          <Check size={14} /> Salvar
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                        >
                          <X size={14} /> Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0"
                            style={{ backgroundColor: cat.color }}
                          />
                          <span className="font-medium text-slate-100">{cat.name}</span>
                          <span
                            className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium border ${
                              cat.type === 'income'
                                ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800/70'
                                : 'bg-rose-950/70 text-rose-300 border-rose-800/70'
                            }`}
                          >
                            {cat.type === 'income' ? 'Receita' : 'Despesa'}
                          </span>
                          {cat.type === 'expense' && spent > 0 && (
                            <span className="text-xs text-slate-400 font-mono-nums">
                              No mês: {formatMoney(spent, privacyMode)}
                            </span>
                          )}
                        </div>

                        {cat.type === 'expense' && limit > 0 && (
                          <div className="max-w-md space-y-1">
                            <div className="flex justify-between text-[11px] text-slate-400 font-mono-nums">
                              <span>
                                Meta: {formatMoney(spent, privacyMode)} de{' '}
                                {formatMoney(limit, privacyMode)}
                              </span>
                              <span
                                className={
                                  pct > 100
                                    ? 'text-rose-400 font-semibold'
                                    : pct >= 80
                                      ? 'text-amber-400 font-semibold'
                                      : 'text-emerald-400'
                                }
                              >
                                {pct.toFixed(0)}%
                              </span>
                            </div>
                            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${
                                  pct > 100
                                    ? 'bg-rose-500'
                                    : pct >= 80
                                      ? 'bg-amber-500'
                                      : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => startEdit(cat)}
                          title="Editar categoria"
                          aria-label={`Editar categoria ${cat.name}`}
                          className="p-2 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDelete(cat)}
                          title="Excluir categoria"
                          aria-label={`Excluir categoria ${cat.name}`}
                          className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Excluir categoria?"
        description={
          pendingDelete
            ? `A categoria "${pendingDelete.name}" será removida. As transações existentes continuarão salvas como "Sem categoria".`
            : ''
        }
        confirmLabel="Excluir categoria"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </main>
  )
}
