import { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { Navigate } from 'react-router-dom'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  BookmarkPlus,
  Calculator,
  Check,
  CheckCircle2,
  Edit3,
  History,
  Package,
  Plus,
  RotateCcw,
  Trash2,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { useToast } from '../contexts/ToastContext'
import { formatDateBR, todayISO } from '../lib/date'
import { formatMoney } from '../lib/formatters'
import ConfirmDialog from '../components/ConfirmDialog'

function calcEntryProfit(entry) {
  const stake = Number(entry.stake) || 0
  const odd = Number(entry.odd) || 0
  switch (entry.status) {
    case 'green':
      return stake * (odd - 1)
    case 'half_green':
      return (stake * (odd - 1)) / 2
    case 'red':
      return -stake
    case 'half_red':
      return -stake / 2
    default:
      return 0
  }
}

function calcNetMargin(grossSale, cost, feePct) {
  const sale = Number(grossSale) || 0
  const c = Number(cost) || 0
  const fee = Math.max(0, Math.min(100, Number(feePct) || 0))
  return sale * (1 - fee / 100) - c
}

export default function Operations() {
  const {
    operationsEnabled,
    bankrollInitial,
    updateBankrollInitial,
    evEntries,
    addEvEntry,
    updateEvEntry,
    removeEvEntry,
    restoreEvEntry,
    inventoryItems,
    addInventoryItem,
    updateInventoryItem,
    removeInventoryItem,
    restoreInventoryItem,
    privacyMode,
  } = useWorkspace()
  const { toast } = useToast()

  const [bankrollInput, setBankrollInput] = useState('')
  const [mode, setMode] = useState('simple')
  const [calTab, setCalTab] = useState('ev')
  const [odd, setOdd] = useState('')
  const [reference, setReference] = useState('')
  const [opposite, setOpposite] = useState('')
  const [fraction, setFraction] = useState('25')
  const [threeOdds, setThreeOdds] = useState({ a: '', b: '', c: '' })
  const [multiple, setMultiple] = useState([
    { main: '', against: '' },
    { main: '', against: '' },
  ])
  const [recalcOdd, setRecalcOdd] = useState('')
  const [recalcNewOdd, setRecalcNewOdd] = useState('')
  const [recalcStake, setRecalcStake] = useState('')
  const [entryLabel, setEntryLabel] = useState('')

  // Estoque de revenda
  const [invTab, setInvTab] = useState('in_stock') // in_stock | sold
  const [itemForm, setItemForm] = useState({
    name: '',
    quantity: '1',
    cost: '',
    target: '',
    feePct: '0',
  })
  const [sellingId, setSellingId] = useState(null)
  const [sellPriceInput, setSellPriceInput] = useState('')
  const [editingItemId, setEditingItemId] = useState(null)
  const [editItemForm, setEditItemForm] = useState({
    name: '',
    quantity: '1',
    cost: '',
    target: '',
    feePct: '0',
  })

  // Exclusão
  const [pendingDelete, setPendingDelete] = useState(null) // { kind: 'ev' | 'inv', item }

  useEffect(() => {
    document.title = 'Operações — ComTabela'
  }, [])

  useEffect(() => {
    setBankrollInput(bankrollInitial > 0 ? String(bankrollInitial) : '')
  }, [bankrollInitial])

  // Evita que a roda do mouse altere o valor de inputs numéricos focados
  useEffect(() => {
    const prevent = (event) => {
      const el = event.target
      if (el && el.tagName === 'INPUT' && el.type === 'number' && el === document.activeElement) {
        event.preventDefault()
      }
    }
    window.addEventListener('wheel', prevent, { passive: false })
    return () => window.removeEventListener('wheel', prevent)
  }, [])

  // Estatísticas da Banca e Diário EV+
  const evStats = useMemo(() => {
    let realizedProfit = 0
    let settledStake = 0
    let settledEv = 0
    let pendingExposure = 0

    evEntries.forEach((entry) => {
      const stake = Number(entry.stake) || 0
      if (entry.status === 'pending') {
        pendingExposure += stake
      } else if (entry.status !== 'void') {
        realizedProfit += calcEntryProfit(entry)
        settledStake += stake
        settledEv += Number(entry.ev) || 0
      }
    })

    const currentBankroll = Math.max(0, (Number(bankrollInitial) || 0) + realizedProfit)
    const yieldPct = settledStake > 0 ? (realizedProfit / settledStake) * 100 : 0

    return {
      realizedProfit,
      settledStake,
      settledEv,
      pendingExposure,
      currentBankroll,
      yieldPct,
    }
  }, [evEntries, bankrollInitial])

  // Série acumulada Lucro vs EV Esperado (cronológica)
  const evChartSeries = useMemo(() => {
    const settled = [...evEntries]
      .filter((e) => e.status !== 'pending' && e.status !== 'void')
      .reverse()

    let accProfit = 0
    let accEv = 0
    return settled.map((entry, idx) => {
      accProfit += calcEntryProfit(entry)
      accEv += Number(entry.ev) || 0
      return {
        index: `#${idx + 1}`,
        Lucro: Number(accProfit.toFixed(2)),
        EV: Number(accEv.toFixed(2)),
      }
    })
  }, [evEntries])

  const activeBankroll = evStats.currentBankroll

  const result = useMemo(() => {
    const o = Number(odd)
    if (o <= 1) return null
    let fair
    if (mode === 'three') {
      const values = Object.values(threeOdds).map(Number)
      if (values.some((value) => value <= 1)) return null
      fair = 1 / (1 / values[0] / values.reduce((sum, value) => sum + 1 / value, 0))
    } else if (mode === 'multiple') {
      if (multiple.some((row) => Number(row.main) <= 1)) return null
      fair = multiple.reduce((product, row) => {
        const main = Number(row.main)
        const against = Number(row.against) || (1 / Math.abs(1 / main - 1)) * 0.91
        return product * (1 / (1 / main / (1 / main + 1 / against)))
      }, 1)
    } else {
      const r = Number(reference)
      const against = Number(opposite) || (r > 1 ? (1 / Math.abs(1 / r - 1)) * 0.91 : 0)
      if (r <= 1 || against <= 1) return null
      fair = 1 / (1 / r / (1 / r + 1 / against))
    }
    const probability = 1 / fair
    const edge = o / fair - 1
    const kelly = ((o - 1) * probability - (1 - probability)) / (o - 1)
    const stake = ((Math.max(0, kelly) * (Number(fraction) || 0)) / 100) * activeBankroll
    return { fair, probability, edge, stake, ev: edge * stake }
  }, [odd, reference, opposite, fraction, activeBankroll, mode, threeOdds, multiple])

  const recalc = useMemo(() => {
    const o0 = Number(recalcOdd)
    const s0 = Number(recalcStake)
    const frac = Number(fraction) || 0
    if (!(o0 > 1 && s0 > 0 && frac > 0)) return { derived: false }
    const kelly0 = (s0 * 100) / frac
    if (!(kelly0 > 0 && kelly0 < 100)) return { derived: false }
    const p = ((kelly0 / 100) * (o0 - 1) + 1) / o0
    if (!(p > 0 && p < 1)) return { derived: false }
    const justa = 1 / p

    const on = Number(recalcNewOdd)
    if (!(on > 1)) return { derived: true, justa, hasNewOdd: false }

    const probability = 1 / justa
    const edge = on / justa - 1
    const kelly = ((on - 1) * probability - (1 - probability)) / (on - 1)
    const newStakePct = Math.max(0, kelly) * frac
    const value = activeBankroll * (newStakePct / 100)
    const ev = edge * value
    const evPositive = kelly > 0
    return {
      derived: true,
      justa,
      hasNewOdd: true,
      probability,
      edge,
      newStakePct,
      value,
      ev,
      evPositive,
    }
  }, [recalcOdd, recalcNewOdd, recalcStake, fraction, activeBankroll])

  const inventoryStats = useMemo(() => {
    return inventoryItems.reduce(
      (acc, row) => {
        const cost = Number(row.cost) || 0
        if (row.status === 'sold') {
          acc.realizedProfit += calcNetMargin(row.soldPrice ?? row.target, cost, row.feePct)
          acc.soldCount += 1
        } else {
          acc.stockCost += cost
          acc.estimatedProfit += calcNetMargin(row.target, cost, row.feePct)
          acc.inStockCount += 1
        }
        return acc
      },
      { stockCost: 0, estimatedProfit: 0, realizedProfit: 0, inStockCount: 0, soldCount: 0 }
    )
  }, [inventoryItems])

  if (!operationsEnabled) return <Navigate to="/dashboard" replace />

  const handleSaveBankroll = (event) => {
    event.preventDefault()
    updateBankrollInitial(bankrollInput)
    toast({
      title: 'Banca base atualizada',
      description: `Capital inicial definido em ${formatMoney(bankrollInput)}.`,
    })
  }

  const handleRecordEvEntry = () => {
    if (calTab === 'recalc') {
      if (!recalc.derived || !recalc.hasNewOdd || !recalc.evPositive) return
      addEvEntry({
        date: todayISO(),
        description: entryLabel.trim() || `Entrada @${Number(recalcNewOdd).toFixed(2)}`,
        odd: Number(recalcNewOdd),
        fairOdd: recalc.justa,
        edgePct: recalc.edge * 100,
        stake: recalc.value,
        ev: recalc.ev,
        status: 'pending',
      })
    } else {
      if (!result || result.stake <= 0) return
      addEvEntry({
        date: todayISO(),
        description: entryLabel.trim() || `Entrada @${Number(odd).toFixed(2)}`,
        odd: Number(odd),
        fairOdd: result.fair,
        edgePct: result.edge * 100,
        stake: result.stake,
        ev: result.ev,
        status: 'pending',
      })
    }
    setEntryLabel('')
    toast({ title: 'Entrada registrada no diário EV+' })
  }

  const handleAddInventory = (event) => {
    event.preventDefault()
    if (!itemForm.name.trim() || !itemForm.cost) return
    addInventoryItem({
      name: itemForm.name,
      quantity: Number(itemForm.quantity) || 1,
      cost: Number(itemForm.cost) || 0,
      target: Number(itemForm.target) || 0,
      feePct: Number(itemForm.feePct) || 0,
      status: 'in_stock',
    })
    setItemForm({ name: '', quantity: '1', cost: '', target: '', feePct: '0' })
    toast({ title: 'Item adicionado ao estoque', description: itemForm.name.trim() })
  }

  const handleConfirmSell = (item) => {
    const price = Number(sellPriceInput)
    if (!Number.isFinite(price) || price < 0) return
    updateInventoryItem(item.id, {
      status: 'sold',
      soldPrice: price,
      soldDate: todayISO(),
    })
    setSellingId(null)
    setSellPriceInput('')
    toast({
      title: 'Venda concluída',
      description: `${item.name} vendido por ${formatMoney(price)}.`,
    })
  }

  const startEditItem = (row) => {
    setEditingItemId(row.id)
    setEditItemForm({
      name: row.name || '',
      quantity: String(row.quantity || 1),
      cost: String(row.cost || 0),
      target: String(row.target || 0),
      feePct: String(row.feePct || 0),
    })
  }

  const saveEditItem = (id) => {
    if (!editItemForm.name.trim()) return
    updateInventoryItem(id, {
      name: editItemForm.name.trim(),
      quantity: Math.max(1, Number(editItemForm.quantity) || 1),
      cost: Math.max(0, Number(editItemForm.cost) || 0),
      target: Math.max(0, Number(editItemForm.target) || 0),
      feePct: Math.max(0, Math.min(100, Number(editItemForm.feePct) || 0)),
    })
    setEditingItemId(null)
    toast({ title: 'Item atualizado' })
  }

  const confirmDelete = () => {
    if (!pendingDelete) return
    const { kind, item } = pendingDelete
    setPendingDelete(null)

    if (kind === 'ev') {
      removeEvEntry(item.id)
      toast({
        title: 'Entrada removida',
        description: item.description,
        actionLabel: 'Desfazer',
        onAction: () => restoreEvEntry(item),
      })
    } else {
      removeInventoryItem(item.id)
      toast({
        title: 'Item removido do estoque',
        description: item.name,
        actionLabel: 'Desfazer',
        onAction: () => restoreInventoryItem(item),
      })
    }
  }

  const visibleInventory = inventoryItems.filter((row) =>
    invTab === 'sold' ? row.status === 'sold' : row.status !== 'sold'
  )

  const calculatorInputs =
    mode === 'three' ? (
      <>
        <CalcInput label="Odd apostada (A)" value={odd} change={setOdd} />
        <CalcInput
          label="Vitória (A)"
          value={threeOdds.a}
          change={(value) => setThreeOdds({ ...threeOdds, a: value })}
        />
        <CalcInput
          label="Empate (B)"
          value={threeOdds.b}
          change={(value) => setThreeOdds({ ...threeOdds, b: value })}
        />
        <CalcInput
          label="Derrota (C)"
          value={threeOdds.c}
          change={(value) => setThreeOdds({ ...threeOdds, c: value })}
        />
      </>
    ) : mode === 'multiple' ? (
      <>
        <CalcInput label="Odd total apostada" value={odd} change={setOdd} />
        {multiple.map((row, index) => (
          <div key={index} className="grid grid-cols-2 gap-2 col-span-2">
            <CalcInput
              label={`Seleção ${index + 1}`}
              value={row.main}
              change={(value) =>
                setMultiple(
                  multiple.map((item, i) => (i === index ? { ...item, main: value } : item))
                )
              }
            />
            <CalcInput
              label="Contra"
              value={row.against}
              change={(value) =>
                setMultiple(
                  multiple.map((item, i) => (i === index ? { ...item, against: value } : item))
                )
              }
              placeholder="automática"
              hint={
                Number(row.main) > 1 && !(Number(row.against) > 1)
                  ? `» auto: ${((1 / Math.abs(1 / Number(row.main) - 1)) * 0.91).toFixed(4)}`
                  : ''
              }
            />
          </div>
        ))}
      </>
    ) : (
      <>
        <CalcInput label="Odd apostada" value={odd} change={setOdd} />
        <CalcInput label="Odd referência" value={reference} change={setReference} />
        <CalcInput
          label="Odd contrária"
          value={opposite}
          change={setOpposite}
          placeholder="automática"
          hint={
            Number(reference) > 1 && !(Number(opposite) > 1)
              ? `» auto: ${((1 / Math.abs(1 / Number(reference) - 1)) * 0.91).toFixed(4)}`
              : ''
          }
        />
      </>
    )

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100">
          Operações
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Gestão de banca EV+, diário de performance e controle de estoque de revenda
        </p>
      </header>

      {/* Indicadores Operacionais */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={<Wallet size={18} />}
          title="Banca atual"
          value={formatMoney(activeBankroll, privacyMode)}
          subtitle={`Base: ${formatMoney(bankrollInitial, privacyMode)} · Em aberto: ${formatMoney(evStats.pendingExposure, privacyMode)}`}
          tone="emerald"
        />
        <SummaryCard
          icon={<TrendingUp size={18} />}
          title="Lucro EV+ realizado"
          value={formatMoney(evStats.realizedProfit, privacyMode)}
          subtitle={`EV esperado: ${formatMoney(evStats.settledEv, privacyMode)} · Yield: ${evStats.yieldPct.toFixed(1)}%`}
          tone={evStats.realizedProfit >= 0 ? 'sky' : 'rose'}
        />
        <SummaryCard
          icon={<Package size={18} />}
          title="Capital em estoque"
          value={formatMoney(inventoryStats.stockCost, privacyMode)}
          subtitle={`${inventoryStats.inStockCount} itens ativos · Margem: ${formatMoney(inventoryStats.estimatedProfit, privacyMode)}`}
          tone="amber"
        />
        <SummaryCard
          icon={<CheckCircle2 size={18} />}
          title="Lucro de revendas"
          value={formatMoney(inventoryStats.realizedProfit, privacyMode)}
          subtitle={`${inventoryStats.soldCount} itens vendidos`}
          tone="emerald"
        />
      </section>

      {/* Calculadora EV + Estoque de Revenda */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Calculadora EV */}
        <div className="surface-card p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Calculator size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">Calculadora EV & Kelly</h2>
              <p className="text-xs text-slate-400">
                Stakes calculadas automaticamente sobre a banca atual ({formatMoney(activeBankroll, privacyMode)})
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveBankroll} className="flex gap-2">
            <input
              id="ops-bankroll-input"
              type="number"
              min="0"
              step="0.01"
              value={bankrollInput}
              onChange={(event) => setBankrollInput(event.target.value)}
              placeholder="Banca base inicial (R$)"
              className="input-base flex-1 min-w-0"
            />
            <button
              type="submit"
              id="btn-save-bankroll"
              className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-semibold px-4 rounded-xl transition-colors cursor-pointer"
            >
              Salvar banca base
            </button>
          </form>

          <div className="grid grid-cols-2 gap-2 bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setCalTab('ev')}
              className={`py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                calTab === 'ev' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Calculadora EV
            </button>
            <button
              type="button"
              onClick={() => setCalTab('recalc')}
              className={`py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                calTab === 'recalc'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Odd alterada
            </button>
          </div>

          {calTab === 'recalc' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <CalcInput label="Odd original" value={recalcOdd} change={setRecalcOdd} />
                <CalcInput
                  label="Stake original (% da banca)"
                  value={recalcStake}
                  change={setRecalcStake}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <CalcInput label="Odd nova (atual)" value={recalcNewOdd} change={setRecalcNewOdd} />
                <CalcInput label="Kelly (%)" value={fraction} change={setFraction} />
              </div>

              {recalc && recalc.derived ? (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-2 gap-3">
                    <ResultTile label="Odd justa" value={recalc.justa.toFixed(3)} />
                    <ResultTile
                      label="Prob. real"
                      value={`${(recalc.probability * 100).toFixed(1)}%`}
                    />
                  </div>
                  {recalc.hasNewOdd ? (
                    <div className="grid grid-cols-2 gap-3">
                      <ResultTile
                        label="Stake nova (% banca)"
                        value={`${recalc.newStakePct.toFixed(2)}%`}
                        positive={recalc.evPositive}
                      />
                      <ResultTile
                        label="Valor (R$)"
                        value={formatMoney(recalc.value, privacyMode)}
                        positive={recalc.evPositive}
                      />
                      <ResultTile
                        label="Edge"
                        value={`${(recalc.edge * 100).toFixed(2)}%`}
                        positive={recalc.edge > 0}
                      />
                      <ResultTile
                        label="EV (R$)"
                        value={formatMoney(recalc.ev, privacyMode)}
                        positive={recalc.evPositive}
                      />
                    </div>
                  ) : (
                    <p className="text-slate-400 text-xs">
                      Informe a odd nova para recalcular a entrada.
                    </p>
                  )}

                  {recalc.hasNewOdd && !recalc.evPositive && (
                    <p className="text-rose-400 text-xs font-medium">
                      A queda da odd eliminou o valor esperado. Stake zerada — não entrar.
                    </p>
                  )}

                  {recalc.hasNewOdd && recalc.evPositive && recalc.value > 0 && (
                    <div className="flex gap-2 pt-2">
                      <input
                        type="text"
                        value={entryLabel}
                        onChange={(e) => setEntryLabel(e.target.value)}
                        placeholder="Descrição opcional (ex.: Jogo / Mercado)"
                        className="input-base flex-1 text-xs"
                      />
                      <button
                        type="button"
                        onClick={handleRecordEvEntry}
                        className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors cursor-pointer shrink-0"
                      >
                        <BookmarkPlus size={15} />
                        <span>Registrar</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-slate-500 text-xs">
                  Informe odd original acima de 1 e a stake original para derivar a odd justa.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {[
                  ['simple', 'Simples'],
                  ['three', '3 resultados'],
                  ['multiple', 'Múltipla 2'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setMode(key)}
                    className={`py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      mode === key
                        ? 'bg-slate-800 text-emerald-300 border border-emerald-500/30'
                        : 'bg-slate-900 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {calculatorInputs}
                <CalcInput label="Kelly (%)" value={fraction} change={setFraction} />
              </div>

              {result ? (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <ResultTile label="Odd justa" value={result.fair.toFixed(3)} />
                    <ResultTile
                      label="Probabilidade"
                      value={`${(result.probability * 100).toFixed(1)}%`}
                    />
                    <ResultTile
                      label="Edge"
                      value={`${(result.edge * 100).toFixed(2)}%`}
                      positive={result.edge > 0}
                    />
                    <ResultTile
                      label="Stake sugerida"
                      value={formatMoney(result.stake, privacyMode)}
                      positive={result.stake > 0}
                    />
                    <ResultTile
                      label="EV esperado"
                      value={formatMoney(result.ev, privacyMode)}
                      positive={result.ev > 0}
                    />
                  </div>

                  {result.stake > 0 && (
                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        value={entryLabel}
                        onChange={(e) => setEntryLabel(e.target.value)}
                        placeholder="Identificação (ex.: Time A x Time B - ML)"
                        className="input-base flex-1 text-xs"
                      />
                      <button
                        type="button"
                        id="btn-record-ev"
                        onClick={handleRecordEvEntry}
                        className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors cursor-pointer shrink-0"
                      >
                        <BookmarkPlus size={15} />
                        <span>Registrar entrada</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-slate-500 text-xs">Informe odds acima de 1,00 para calcular.</p>
              )}
            </div>
          )}

          <p className="text-slate-500 text-[11px]">
            Ferramenta matemática de gestão de risco. Não constitui recomendação financeira.
          </p>
        </div>

        {/* Estoque de Revenda */}
        <div className="surface-card p-6 space-y-5 flex flex-col">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
                <Package size={18} />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-100">Estoque de revenda</h2>
                <p className="text-xs text-slate-400">Custo, taxas de venda e lucro realizado</p>
              </div>
            </div>

            <div className="inline-flex bg-slate-900 border border-slate-800 rounded-xl p-1">
              <button
                type="button"
                onClick={() => setInvTab('in_stock')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                  invTab === 'in_stock' ? 'bg-sky-600 text-white' : 'text-slate-400'
                }`}
              >
                Ativos ({inventoryStats.inStockCount})
              </button>
              <button
                type="button"
                onClick={() => setInvTab('sold')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                  invTab === 'sold' ? 'bg-emerald-600 text-white' : 'text-slate-400'
                }`}
              >
                Vendidos ({inventoryStats.soldCount})
              </button>
            </div>
          </div>

          <form onSubmit={handleAddInventory} className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
            <input
              required
              placeholder="Produto"
              value={itemForm.name}
              onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
              className="input-base col-span-2"
            />
            <input
              type="number"
              min="1"
              placeholder="Qtd"
              value={itemForm.quantity}
              onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })}
              className="input-base"
              title="Quantidade"
            />
            <input
              required
              type="number"
              min="0"
              step="0.01"
              placeholder="Custo R$"
              value={itemForm.cost}
              onChange={(e) => setItemForm({ ...itemForm, cost: e.target.value })}
              className="input-base"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Alvo R$"
              value={itemForm.target}
              onChange={(e) => setItemForm({ ...itemForm, target: e.target.value })}
              className="input-base"
            />
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              placeholder="Taxa %"
              value={itemForm.feePct}
              onChange={(e) => setItemForm({ ...itemForm, feePct: e.target.value })}
              className="input-base"
              title="Taxa de marketplace (%)"
            />
            <button
              type="submit"
              id="btn-add-inventory"
              className="col-span-2 sm:col-span-6 inline-flex items-center justify-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold py-2.5 px-4 rounded-xl transition-colors cursor-pointer"
            >
              <Plus size={15} />
              <span>Adicionar ao estoque</span>
            </button>
          </form>

          <div className="flex-1 overflow-y-auto max-h-96 pr-1">
            {visibleInventory.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">
                {invTab === 'sold'
                  ? 'Nenhum item vendido ainda.'
                  : 'Nenhum item ativo em estoque.'}
              </p>
            ) : (
              <ul className="divide-y divide-slate-800/80">
                {visibleInventory.map((row) => {
                  const isEditing = editingItemId === row.id
                  const isSelling = sellingId === row.id
                  const isSold = row.status === 'sold'
                  const margin = calcNetMargin(
                    isSold ? (row.soldPrice ?? row.target) : row.target,
                    row.cost,
                    row.feePct
                  )

                  if (isEditing) {
                    return (
                      <li key={row.id} className="py-3 space-y-2">
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                          <input
                            value={editItemForm.name}
                            onChange={(e) =>
                              setEditItemForm({ ...editItemForm, name: e.target.value })
                            }
                            className="input-base text-xs col-span-2"
                          />
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editItemForm.cost}
                            onChange={(e) =>
                              setEditItemForm({ ...editItemForm, cost: e.target.value })
                            }
                            className="input-base text-xs"
                            placeholder="Custo"
                          />
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editItemForm.target}
                            onChange={(e) =>
                              setEditItemForm({ ...editItemForm, target: e.target.value })
                            }
                            className="input-base text-xs"
                            placeholder="Alvo"
                          />
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={editItemForm.feePct}
                            onChange={(e) =>
                              setEditItemForm({ ...editItemForm, feePct: e.target.value })
                            }
                            className="input-base text-xs"
                            placeholder="Taxa %"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingItemId(null)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 text-xs text-slate-300 cursor-pointer"
                          >
                            <X size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => saveEditItem(row.id)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 text-xs text-white cursor-pointer"
                          >
                            <Check size={13} />
                          </button>
                        </div>
                      </li>
                    )
                  }

                  return (
                    <li key={row.id} className="py-3 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-100 truncate">
                            {row.quantity > 1 ? `${row.quantity}x ` : ''}
                            {row.name}
                          </p>
                          <p className="text-xs text-slate-400 font-mono-nums mt-0.5">
                            Custo: {formatMoney(row.cost, privacyMode)} ·{' '}
                            {isSold
                              ? `Vendido: ${formatMoney(row.soldPrice, privacyMode)}`
                              : `Alvo: ${formatMoney(row.target, privacyMode)}`}
                            {Number(row.feePct) > 0 ? ` · Taxa ${row.feePct}%` : ''}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`text-xs font-semibold font-mono-nums mr-1 ${
                              margin >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {margin >= 0 ? '+' : ''}
                            {formatMoney(margin, privacyMode)}
                          </span>

                          {!isSold ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSellingId(isSelling ? null : row.id)
                                setSellPriceInput(String(row.target || row.cost || ''))
                              }}
                              className="px-2 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-[11px] font-semibold cursor-pointer"
                            >
                              Vender
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                updateInventoryItem(row.id, {
                                  status: 'in_stock',
                                  soldPrice: null,
                                  soldDate: null,
                                })
                              }
                              title="Retornar ao estoque"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 cursor-pointer"
                            >
                              <RotateCcw size={14} />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => startEditItem(row)}
                            aria-label={`Editar ${row.name}`}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-sky-400 cursor-pointer"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDelete({ kind: 'inv', item: row })}
                            aria-label={`Excluir ${row.name}`}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {isSelling && (
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={sellPriceInput}
                            onChange={(e) => setSellPriceInput(e.target.value)}
                            placeholder="Valor real da venda (R$)"
                            className="input-base py-1 px-2.5 text-xs flex-1"
                          />
                          <button
                            type="button"
                            onClick={() => handleConfirmSell(row)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
                          >
                            Confirmar venda
                          </button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* Diário de Entradas EV+ e Curva Realizado vs EV */}
      <section className="surface-card p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <History size={18} className="text-emerald-400" />
            <div>
              <h2 className="text-base font-semibold text-slate-100">Diário de Entradas EV+</h2>
              <p className="text-xs text-slate-400">
                Acompanhe resultados reais contra o valor esperado matemático
              </p>
            </div>
          </div>
          <span className="text-xs text-slate-400 font-mono-nums">
            {evEntries.length} entradas registradas
          </span>
        </div>

        {evChartSeries.length >= 2 && (
          <div className="h-52 w-full surface-elevated p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evChartSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" vertical={false} />
                <XAxis
                  dataKey="index"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f1623',
                    borderColor: 'rgba(148,163,184,0.2)',
                    borderRadius: '0.75rem',
                    fontSize: '12px',
                  }}
                  formatter={(val) => formatMoney(val, privacyMode)}
                />
                <Line
                  type="monotone"
                  dataKey="Lucro"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="EV"
                  stroke="#0ea5e9"
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {evEntries.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6">
            Use o botão &ldquo;Registrar entrada&rdquo; na calculadora acima para iniciar seu diário EV+.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead className="text-left text-xs text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Data</th>
                  <th className="py-2.5 px-3">Entrada</th>
                  <th className="py-2.5 px-3">Odd / Justa</th>
                  <th className="py-2.5 px-3">Edge</th>
                  <th className="py-2.5 px-3">Stake</th>
                  <th className="py-2.5 px-3">Resultado</th>
                  <th className="py-2.5 px-3 text-right">Lucro / P&L</th>
                  <th className="py-2.5 px-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {evEntries.map((entry) => {
                  const pnl = calcEntryProfit(entry)
                  return (
                    <tr key={entry.id} className="hover:bg-slate-900/40">
                      <td className="py-2.5 px-3 font-mono-nums text-slate-400 whitespace-nowrap">
                        {formatDateBR(entry.date)}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-100">
                        {entry.description}
                      </td>
                      <td className="py-2.5 px-3 font-mono-nums text-slate-300 whitespace-nowrap">
                        {Number(entry.odd).toFixed(2)}{' '}
                        <span className="text-slate-500">/ {Number(entry.fairOdd).toFixed(2)}</span>
                      </td>
                      <td className="py-2.5 px-3 font-mono-nums text-emerald-400 whitespace-nowrap">
                        +{Number(entry.edgePct).toFixed(2)}%
                      </td>
                      <td className="py-2.5 px-3 font-mono-nums text-slate-200 whitespace-nowrap">
                        {formatMoney(entry.stake, privacyMode)}
                      </td>
                      <td className="py-2.5 px-3">
                        <select
                          aria-label={`Resultado de ${entry.description}`}
                          value={entry.status}
                          onChange={(e) => updateEvEntry(entry.id, { status: e.target.value })}
                          className="bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1 text-xs text-slate-200"
                        >
                          <option value="pending">Pendente</option>
                          <option value="green">Green</option>
                          <option value="half_green">Meio Green</option>
                          <option value="red">Red</option>
                          <option value="half_red">Meio Red</option>
                          <option value="void">Devolvida (Void)</option>
                        </select>
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono-nums font-semibold whitespace-nowrap ${
                          pnl > 0
                            ? 'text-emerald-400'
                            : pnl < 0
                              ? 'text-rose-400'
                              : 'text-slate-400'
                        }`}
                      >
                        {entry.status === 'pending'
                          ? `EV ${formatMoney(entry.ev, privacyMode)}`
                          : `${pnl > 0 ? '+' : ''}${formatMoney(pnl, privacyMode)}`}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => setPendingDelete({ kind: 'ev', item: entry })}
                          aria-label={`Remover ${entry.description}`}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={pendingDelete?.kind === 'ev' ? 'Remover entrada do diário?' : 'Remover item do estoque?'}
        description={
          pendingDelete
            ? `Confirma a exclusão de "${pendingDelete.item.description || pendingDelete.item.name}"?`
            : ''
        }
        confirmLabel="Remover"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </main>
  )
}

function SummaryCard({ icon, title, value, subtitle, tone }) {
  const tones = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
    sky: 'text-sky-400 bg-sky-500/10 border-sky-500/25',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
    rose: 'text-rose-400 bg-rose-500/10 border-rose-500/25',
  }
  return (
    <div className="surface-card p-5">
      <div className="flex items-center gap-2.5">
        <span className={`w-8 h-8 rounded-lg border flex items-center justify-center ${tones[tone]}`}>
          {icon}
        </span>
        <span className="text-xs font-medium text-slate-300">{title}</span>
      </div>
      <p className="text-xl font-bold font-mono-nums text-slate-100 mt-3">{value}</p>
      <p className="text-[11px] text-slate-400 mt-1 font-mono-nums">{subtitle}</p>
    </div>
  )
}

function CalcInput({ label, value, change, placeholder = '', hint = '' }) {
  return (
    <label className="text-xs font-medium text-slate-300 block">
      {label}
      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        placeholder={placeholder}
        onChange={(event) => change(event.target.value)}
        className="input-base mt-1 w-full font-mono-nums"
      />
      {hint ? <p className="text-[11px] text-sky-400 mt-1 font-mono-nums">{hint}</p> : null}
    </label>
  )
}

function ResultTile({ label, value, positive = false }) {
  return (
    <div className="surface-elevated p-3">
      <p className="text-[11px] text-slate-400">{label}</p>
      <p
        className={`font-mono-nums text-sm mt-0.5 font-semibold ${
          positive ? 'text-emerald-400' : 'text-slate-100'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

SummaryCard.propTypes = {
  icon: PropTypes.node.isRequired,
  title: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  subtitle: PropTypes.string.isRequired,
  tone: PropTypes.oneOf(['emerald', 'sky', 'amber', 'rose']).isRequired,
}

CalcInput.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  change: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  hint: PropTypes.string,
}

ResultTile.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  positive: PropTypes.bool,
}