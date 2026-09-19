import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ArrowLeft, Calculator, Package, Wallet } from 'lucide-react'
import PropTypes from 'prop-types'

const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)

export default function Operations() {
  const [enabled] = useState(() => localStorage.getItem('comtabela-operations') === 'true')
  const [bankroll, setBankroll] = useState(() => localStorage.getItem('comtabela-bankroll') || '')
  const [mode, setMode] = useState('simple')
  const [calTab, setCalTab] = useState('ev')
  const [odd, setOdd] = useState('')
  const [reference, setReference] = useState('')
  const [opposite, setOpposite] = useState('')
  const [fraction, setFraction] = useState('25')
  const [threeOdds, setThreeOdds] = useState({ a: '', b: '', c: '' })
  const [multiple, setMultiple] = useState([{ main: '', against: '' }, { main: '', against: '' }])
  const [recalcOdd, setRecalcOdd] = useState('')
  const [recalcNewOdd, setRecalcNewOdd] = useState('')
  const [recalcStake, setRecalcStake] = useState('')
  const [items, setItems] = useState(() => JSON.parse(localStorage.getItem('comtabela-inventory') || '[]'))
  const [item, setItem] = useState({ name: '', cost: '', target: '' })

  const result = useMemo(() => {
    const o = Number(odd)
    if (o <= 1) return null
    let fair
    if (mode === 'three') {
      const values = Object.values(threeOdds).map(Number)
      if (values.some((value) => value <= 1)) return null
      fair = 1 / ((1 / values[0]) / values.reduce((sum, value) => sum + 1 / value, 0))
    } else if (mode === 'multiple') {
      if (multiple.some((row) => Number(row.main) <= 1)) return null
      fair = multiple.reduce((product, row) => {
        const main = Number(row.main), against = Number(row.against) || (1 / Math.abs((1 / main) - 1)) * 0.91
        return product * (1 / ((1 / main) / ((1 / main) + (1 / against))))
      }, 1)
    } else {
      const r = Number(reference), against = Number(opposite) || (r > 1 ? (1 / Math.abs((1 / r) - 1)) * 0.91 : 0)
      if (r <= 1 || against <= 1) return null
      fair = 1 / ((1 / r) / ((1 / r) + (1 / against)))
    }
    const probability = 1 / fair, edge = o / fair - 1
    const kelly = ((o - 1) * probability - (1 - probability)) / (o - 1)
    const stake = Math.max(0, kelly) * (Number(fraction) || 0) / 100 * (Number(bankroll) || 0)
    return { fair, probability, edge, stake, ev: edge * stake }
  }, [odd, reference, opposite, fraction, bankroll, mode, threeOdds, multiple])

  // Recalculo quando a odd muda. De odd original + stake original deriva a odd
  // justa (inversa do Kelly) e calcula normalmente o novo valor vs a odd nova.
  const recalc = useMemo(() => {
    const o0 = Number(recalcOdd)
    const s0 = Number(recalcStake)
    const frac = Number(fraction) || 0
    if (!(o0 > 1 && s0 > 0 && frac > 0)) return { derived: false }
    // kelly integral (antes de aplicar a fracao) implicado pelo stake original
    const kelly0 = (s0 * 100) / frac
    if (!(kelly0 > 0 && kelly0 < 100)) return { derived: false }
    // Inversa do Kelly: kelly = (o*P - 1)/(o - 1)  ->  P = (kelly*(o - 1) + 1)/o
    const p = ((kelly0 / 100) * (o0 - 1) + 1) / o0
    if (!(p > 0 && p < 1)) return { derived: false }
    const justa = 1 / p

    const on = Number(recalcNewOdd)
    if (!(on > 1)) return { derived: true, justa, hasNewOdd: false }

    const probability = 1 / justa
    const edge = on / justa - 1
    const kelly = ((on - 1) * probability - (1 - probability)) / (on - 1)
    const newStakePct = Math.max(0, kelly) * frac
    const value = (Number(bankroll) || 0) * (newStakePct / 100)
    const ev = edge * value
    const evPositive = kelly > 0
    return { derived: true, justa, hasNewOdd: true, probability, edge, newStakePct, value, ev, evPositive }
  }, [recalcOdd, recalcNewOdd, recalcStake, fraction, bankroll])

  const inventory = useMemo(() => items.reduce((sum, row) => ({ cost: sum.cost + Number(row.cost), target: sum.target + Number(row.target) }), { cost: 0, target: 0 }), [items])

  // Evita que a roda do mouse mude o valor de inputs numéricos focados.
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

  if (!enabled) return <Navigate to="/dashboard" replace />

  const saveBankroll = (event) => {
    event.preventDefault()
    localStorage.setItem('comtabela-bankroll', bankroll)
  }

  const addItem = (event) => {
    event.preventDefault()
    if (!item.name || !item.cost) return
    const next = [...items, { ...item, id: crypto.randomUUID() }]
    setItems(next)
    localStorage.setItem('comtabela-inventory', JSON.stringify(next))
    setItem({ name: '', cost: '', target: '' })
  }

  const calculatorInputs = mode === 'three' ? (
    <>
      <Input label="Odd apostada (A)" value={odd} change={setOdd} />
      <Input label="Vitória (A)" value={threeOdds.a} change={(value) => setThreeOdds({ ...threeOdds, a: value })} />
      <Input label="Empate (B)" value={threeOdds.b} change={(value) => setThreeOdds({ ...threeOdds, b: value })} />
      <Input label="Derrota (C)" value={threeOdds.c} change={(value) => setThreeOdds({ ...threeOdds, c: value })} />
    </>
  ) : mode === 'multiple' ? (
    <>
      <Input label="Odd total apostada" value={odd} change={setOdd} />
      {multiple.map((row, index) => (
        <div key={index} className="grid grid-cols-2 gap-2 col-span-2">
          <Input label={`Seleção ${index + 1}`} value={row.main} change={(value) => setMultiple(multiple.map((item, i) => i === index ? { ...item, main: value } : item))} />
          <Input label="Contra" value={row.against} change={(value) => setMultiple(multiple.map((item, i) => i === index ? { ...item, against: value } : item))} placeholder="automática" hint={Number(row.main) > 1 && !(Number(row.against) > 1) ? `» auto: ${((1 / Math.abs((1 / Number(row.main)) - 1)) * 0.91).toFixed(4)}` : ''} />
        </div>
      ))}
    </>
  ) : (
    <>
      <Input label="Odd apostada" value={odd} change={setOdd} />
      <Input label="Odd referência" value={reference} change={setReference} />
      <Input label="Odd contrária" value={opposite} change={setOpposite} placeholder="automática" hint={Number(reference) > 1 && !(Number(opposite) > 1) ? `» auto: ${((1 / Math.abs((1 / Number(reference)) - 1)) * 0.91).toFixed(4)}` : ''} />
    </>
  )
return (
    <main className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <Link to="/dashboard" className="inline-flex gap-2 text-gray-400 mb-5"><ArrowLeft size={18} /> Voltar ao início</Link>
      <h1 className="text-3xl font-bold">Operações</h1>
      <p className="text-gray-400 mt-1 mb-6">Capital operacional separado das finanças pessoais.</p>
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card icon={<Wallet />} title="Banca" value={money(bankroll)} />
        <Card icon={<Package />} title="Estoque" value={money(inventory.cost)} />
        <Card icon={<Package />} title="Margem estimada" value={money(inventory.target - inventory.cost)} />
      </section>
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex gap-3 mb-5">
            <Calculator className="text-emerald-400" />
            <div>
              <h2 className="text-xl font-semibold">Calculadora EV</h2>
              <p className="text-sm text-gray-400">Odds justas, edge e Kelly fracionado.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button type="button" onClick={() => setCalTab('ev')} className={calTab === 'ev' ? 'bg-emerald-600 rounded-lg py-2 text-sm' : 'bg-gray-800 rounded-lg py-2 text-sm text-gray-400'}>Calculadora EV</button>
            <button type="button" onClick={() => setCalTab('recalc')} className={calTab === 'recalc' ? 'bg-emerald-600 rounded-lg py-2 text-sm' : 'bg-gray-800 rounded-lg py-2 text-sm text-gray-400'}>Odd alterada</button>
          </div>
          <form onSubmit={saveBankroll} className="flex gap-2 mb-4">
            <input type="number" min="0" step="0.01" value={bankroll} onChange={(event) => setBankroll(event.target.value)} placeholder="Banca atual" className="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2" />
            <button className="bg-gray-700 px-4 rounded-lg">Salvar</button>
          </form>
          {calTab === 'recalc' ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Odd original" value={recalcOdd} change={setRecalcOdd} />
                <Input label="Stake original (% da banca)" value={recalcStake} change={setRecalcStake} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Odd nova (atual)" value={recalcNewOdd} change={setRecalcNewOdd} />
                <Input label="Kelly (%)" value={fraction} change={setFraction} />
              </div>
              {recalc && recalc.derived ? (
                <>
                  <div className="grid grid-cols-2 gap-3 mt-5">
                    <Result label="Odd justa" value={recalc.justa.toFixed(3)} />
                    <Result label="Prob. real" value={`${(recalc.probability * 100).toFixed(1)}%`} />
                  </div>
                  {recalc.hasNewOdd ? (
                    <div className="grid grid-cols-2 gap-3 mt-5">
                      <Result label="Stake nova (% banca)" value={`${recalc.newStakePct.toFixed(2)}%`} green={recalc.evPositive} />
                      <Result label="Valor (R$)" value={money(recalc.value)} green={recalc.evPositive} />
                      <Result label="Edge" value={`${(recalc.edge * 100).toFixed(2)}%`} green={recalc.edge > 0} />
                      <Result label="EV (R$)" value={money(recalc.ev)} green={recalc.evPositive} />
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm mt-4">Informe a odd nova para ver quanto vale agora.</p>
                  )}
                  {recalc.hasNewOdd && !recalc.evPositive && <p className="text-red-400 text-sm mt-3">A queda da odd matou o valor. Stake zerada — não apostar.</p>}
                </>
              ) : (
                <p className="text-gray-500 text-sm mt-5">Informe odd original acima de 1 e a stake original para derivar a odd justa.</p>
              )}
            </>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[['simple', 'Simples'], ['three', '3 resultados'], ['multiple', 'Múltipla 2']].map(([key, label]) => (
                  <button key={key} type="button" onClick={() => setMode(key)} className={mode === key ? 'bg-emerald-600 rounded-lg py-2 text-sm' : 'bg-gray-800 rounded-lg py-2 text-sm text-gray-400'}>{label}</button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {calculatorInputs}
                <Input label="Kelly (%)" value={fraction} change={setFraction} />
              </div>
              {result ? (
                <div className="grid grid-cols-2 gap-3 mt-5">
                  <Result label="Odd justa" value={result.fair.toFixed(3)} />
                  <Result label="Probabilidade" value={`${(result.probability * 100).toFixed(1)}%`} />
                  <Result label="Edge" value={`${(result.edge * 100).toFixed(2)}%`} green={result.edge > 0} />
                  <Result label="Stake" value={money(result.stake)} green={result.stake > 0} />
                  <Result label="EV" value={money(result.ev)} green={result.ev > 0} />
                </div>
              ) : (
                <p className="text-gray-500 text-sm mt-5">Informe odds acima de 1 para calcular.</p>
              )}
            </>
          )}
          <p className="text-gray-500 text-xs mt-5">Ferramenta de registro e risco. Não é recomendação de aposta.</p>
        </div>
<div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex gap-3 mb-5">
            <Package className="text-blue-400" />
            <div>
              <h2 className="text-xl font-semibold">Estoque de revenda</h2>
              <p className="text-sm text-gray-400">Custo e venda alvo antes de comprar.</p>
            </div>
          </div>
          <form onSubmit={addItem} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input required value={item.name} onChange={(event) => setItem({ ...item, name: event.target.value })} placeholder="Item" className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2" />
            <input required type="number" min="0" step="0.01" value={item.cost} onChange={(event) => setItem({ ...item, cost: event.target.value })} placeholder="Custo total" className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2" />
            <input type="number" min="0" step="0.01" value={item.target} onChange={(event) => setItem({ ...item, target: event.target.value })} placeholder="Venda alvo" className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2" />
            <button className="sm:col-span-3 bg-blue-600 px-4 py-2 rounded-lg">Adicionar ao estoque</button>
          </form>
          <ul className="mt-5 space-y-3">
            {items.map((row) => (
              <li key={row.id} className="flex justify-between border-b border-gray-800 pb-3">
                <span>{row.name}</span>
                <span className="text-emerald-400">{money(Number(row.target) - Number(row.cost))}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  )
}

function Card({ icon, title, value }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <span className="text-emerald-400">{icon}</span>
      <p className="text-gray-400 mt-3">{title}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}

function Input({ label, value, change, placeholder, hint }) {
  return (
    <label className="text-sm text-gray-400">
      {label}
      <input type="number" min="0" step="0.01" value={value} placeholder={placeholder} onChange={(event) => change(event.target.value)} className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white" />
      {hint ? <p className="text-xs text-blue-400 mt-1">{hint}</p> : null}
    </label>
  )
}

function Result({ label, value, green }) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={green ? 'text-emerald-400 font-semibold' : 'font-semibold'}>{value}</p>
    </div>
  )
}

Card.propTypes = { icon: PropTypes.object, title: PropTypes.string, value: PropTypes.string }
Input.propTypes = { label: PropTypes.string, value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), change: PropTypes.func, placeholder: PropTypes.string, hint: PropTypes.string }
Result.propTypes = { label: PropTypes.string, value: PropTypes.string, green: PropTypes.bool }