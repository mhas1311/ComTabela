import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Plus, Trash2, Edit3, X, Check, ArrowLeft } from 'lucide-react'
import Navbar from '../components/Navbar'

export default function Categories() {
  const { user } = useAuth()
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [type, setType] = useState('expense')
  const [color, setColor] = useState('#10b981')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [showColorPicker, setShowColorPicker] = useState(false)

  const fetchCategories = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .order('name')
    if (error) console.error(error)
    else setCategories(data)
    setLoading(false)
  }

  const DEFAULT_CATEGORIES = [
    { name: 'Compras', type: 'expense', color: '#f46464' },
    { name: 'Trabalho', type: 'income', color: '#00de52' },
    { name: 'Saúde', type: 'expense', color: '#ff0000' },
    { name: 'Lazer', type: 'expense', color: '#ffa200' },
    { name: 'Contas', type: 'expense', color: '#ec2086' },
    { name: 'Transporte', type: 'expense', color: '#920049' },
    { name: 'Alimentação', type: 'expense', color: '#ff9100' },
  ]

  const ensureDefaultCategories = async () => {
    // Garante que TODAS as categorias padrão existam para qualquer usuário,
    // adicionando apenas as que estiverem faltando.

    const normalize = (v) => (v || '').toString().trim().toLowerCase()

    // Busca apenas categorias existentes que batem com a lista padrão,
    // para reduzir chance de corrida/estado e evitar duplicar.
    const missing = []

    // Cria um set com as existentes (name+type) do usuário
    const { data: existing, error: existingError } = await supabase
      .from('categories')
      .select('name,type')
      .eq('user_id', user.id)

    if (existingError) {
      console.error(existingError)
      return
    }

    const existingKeySet = new Set((existing || []).map(c => `${normalize(c.name)}::${normalize(c.type)}`))

    for (const c of DEFAULT_CATEGORIES) {
      const key = `${normalize(c.name)}::${normalize(c.type)}`
      if (!existingKeySet.has(key)) missing.push(c)
    }

    if (missing.length === 0) return

    // Upsert por (user_id, name, type) depende de constraint UNIQUE no banco.
    // Como não sabemos se existe, fazemos tentativa de insert e, em caso de erro,
    // apenas logamos.
    const { error } = await supabase
      .from('categories')
      .insert(
        missing.map(c => ({
          user_id: user.id,
          name: c.name,
          type: c.type,
          color: c.color,
        }))
      )

    if (error) console.error(error)
  }



  useEffect(() => {
    if (!user) return

    const run = async () => {
      await ensureDefaultCategories()
      fetchCategories()
    }

    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Importante: seed roda para qualquer usuário (incluindo antigos) quando entra em /categories


  const handleAdd = async (e) => {
    e.preventDefault()

    if (!name.trim()) return
    const categoryType = type.toLowerCase()
    const { error } = await supabase
      .from('categories')
      .insert({ user_id: user.id, name: name.trim(), type: categoryType, color })
    if (!error) {
      setName('')
      setColor('#10b981')
      fetchCategories()
    }
  }

  const handleDelete = async (id) => {
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (!error) fetchCategories()
  }

  const startEdit = (cat) => {
    setEditingId(cat.id)
    setEditName(cat.name)
  }

  const saveEdit = async (id) => {
    if (!editName.trim()) return
    const { error } = await supabase
      .from('categories')
      .update({ name: editName.trim() })
      .eq('id', id)
    if (!error) {
      setEditingId(null)
      fetchCategories()
    }
  }

  const cancelEdit = () => setEditingId(null)

  const colorOptions = [
    '#ef4444', '#fb923c', '#f59e0b', '#eab308', '#65a30d', '#22c55e',
    '#06b6d4', '#2563eb', '#7c3aed', '#d946ef', '#ec4899', '#9ca3af',
  ]

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <Navbar
        backTo="/dashboard"
        rightSlot={
          <Link
            to="/transactions"
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-lg font-medium transition-colors text-sm"
          >
            Transações
          </Link>
        }
      />

      <h1 className="text-3xl font-bold mb-8">Categorias</h1>

      {/* Formulário de adicionar */}
      <form onSubmit={handleAdd} className="bg-gray-900 rounded-xl p-6 mb-8 border border-gray-800">
        <h2 className="text-lg font-semibold mb-4">Nova categoria</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Nome</label>
            <input type="text" placeholder="Ex: Alimentação" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500" required />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Tipo</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="expense">Despesa</option>
              <option value="income">Receita</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Cor</label>
            <div className="flex flex-wrap gap-2 items-center">
              {colorOptions.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setColor(c)
                    setShowColorPicker(false)
                  }}
                  className={`w-6 h-6 rounded-full border-2 ${color === c ? 'border-white scale-110' : 'border-transparent'} transition-transform`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowColorPicker((prev) => !prev)}
                  className={`w-8 h-8 rounded-full border-2 ${!colorOptions.includes(color) ? 'border-white scale-110' : 'border-transparent'} transition-transform`}
                  style={{
                    background: 'linear-gradient(45deg, #ff0000, #ff8000, #ffff00, #80ff00, #00ff00, #00ff80, #00ffff, #0080ff, #0000ff, #8000ff, #ff00ff, #ff0080)',
                    backgroundSize: '200% 200%',
                    animation: 'gradient 3s ease infinite'
                  }}
                  aria-label="Escolher cor personalizada"
                />
                {showColorPicker && (
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => {
                      setColor(e.target.value)
                      setShowColorPicker(false)
                    }}
                    className="absolute -top-3 left-0 w-8 h-8 rounded-full border-2 border-gray-600 cursor-pointer opacity-0"
                    style={{ zIndex: 20 }}
                    aria-label="Seletor de cores"
                  />
                )}
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">Clique em uma cor pequena ou escolha sua própria com o seletor.</p>
          </div>
        </div>
        <button type="submit" className="mt-4 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 px-6 py-2 rounded-lg font-medium transition-colors">
          <Plus size={18} />
          Adicionar
        </button>
      </form>

      {/* Lista de categorias */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        {loading ? (
          <p className="p-6 text-gray-400">Carregando...</p>
        ) : categories.length === 0 ? (
          <p className="p-6 text-gray-400">Nenhuma categoria criada ainda.</p>
        ) : (
          <ul className="divide-y divide-gray-800">
            {categories.map((cat) => (
              <li key={cat.id} className="p-4 flex items-center justify-between hover:bg-gray-800/50">
                <div className="flex items-center gap-3">
                  <span className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color }} />
                  {editingId === cat.id ? (
                    <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="bg-gray-700 px-2 py-1 rounded text-white focus:outline-none" />
                  ) : (
                    <span>{cat.name}</span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${cat.type === 'income' ? 'bg-emerald-900 text-emerald-300' : 'bg-red-900 text-red-300'}`}>
                    {cat.type === 'income' ? 'Receita' : 'Despesa'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {editingId === cat.id ? (
                    <>
                      <button onClick={() => saveEdit(cat.id)} className="text-emerald-400 hover:text-emerald-300"><Check size={18} /></button>
                      <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-300"><X size={18} /></button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEdit(cat)} className="text-gray-400 hover:text-blue-400"><Edit3 size={16} /></button>
                      <button onClick={() => handleDelete(cat.id)} className="text-gray-400 hover:text-red-400"><Trash2 size={16} /></button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}