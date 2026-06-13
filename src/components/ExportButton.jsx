import { useState } from 'react'
import { Download, FileText, FileSpreadsheet, FileType } from 'lucide-react'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function ExportButton({ transactions }) {
  const [open, setOpen] = useState(false)

  const formatMoney = (value) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

  const getTableData = () => {
    return transactions.map(t => ({
      Data: new Date(t.date).toLocaleDateString('pt-BR'),
      Descrição: t.description,
      Categoria: t.category?.name || 'Sem categoria',
      Tipo: t.type === 'income' ? 'Receita' : 'Despesa',
      Valor: formatMoney(t.amount)
    }))
  }

  // Calcular totais e saldo
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0)
  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0)
  const balance = totalIncome - totalExpense

  const exportCSV = () => {
    const data = getTableData()
    const headers = ['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor']
    const separator = ';'
    const csvRows = [headers.join(separator)]

    data.forEach(row => {
      csvRows.push(`"${row.Data}";"${row.Descrição}";"${row.Categoria}";"${row.Tipo}";"${row.Valor}"`)
    })

    // Adicionar linhas de resumo
    csvRows.push('') // linha em branco
    csvRows.push(`"RESUMO"`)
    csvRows.push(`"Receitas"; ; ; ; "${formatMoney(totalIncome)}"`)
    csvRows.push(`"Despesas"; ; ; ; "${formatMoney(totalExpense)}"`)
    csvRows.push(`"Saldo"; ; ; ; "${formatMoney(balance)}"`)

    const csvContent = '\uFEFF' + csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'comtabela_transacoes.csv'
    link.click()
    URL.revokeObjectURL(url)
    setOpen(false)
  }

  const exportExcel = () => {
    const data = getTableData()
    const ws = XLSX.utils.json_to_sheet(data)

    // Adicionar linhas de resumo
    const lastRow = data.length + 2 // pula cabeçalho e linha em branco
    XLSX.utils.sheet_add_json(
      ws,
      [
        { Data: 'Resumo', Descrição: '', Categoria: '', Tipo: '', Valor: '' },
        { Data: 'Receitas', Descrição: '', Categoria: '', Tipo: '', Valor: formatMoney(totalIncome) },
        { Data: 'Despesas', Descrição: '', Categoria: '', Tipo: '', Valor: formatMoney(totalExpense) },
        { Data: 'Saldo', Descrição: '', Categoria: '', Tipo: '', Valor: formatMoney(balance) },
      ],
      { skipHeader: true, origin: lastRow }
    )

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Transações')
    XLSX.writeFile(wb, 'comtabela_transacoes.xlsx')
    setOpen(false)
  }

  const exportPDF = () => {
    const data = getTableData()
    const doc = new jsPDF()

    doc.text('ComTabela - Transações', 14, 15)

    autoTable(doc, {
      startY: 20,
      head: [['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor']],
      body: data.map(d => [d.Data, d.Descrição, d.Categoria, d.Tipo, d.Valor]),
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [16, 185, 129] },
    })

    // Adicionar resumo após a tabela
    const finalY = doc.lastAutoTable.finalY + 10
    doc.setFontSize(12)
    doc.text(`Receitas: ${formatMoney(totalIncome)}`, 14, finalY)
    doc.text(`Despesas: ${formatMoney(totalExpense)}`, 14, finalY + 8)
    doc.text(`Saldo: ${formatMoney(balance)}`, 14, finalY + 16)

    doc.save('comtabela_transacoes.pdf')
    setOpen(false)
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
      >
        <Download size={18} />
        Exportar
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-44 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-10">
          <ul className="py-1">
            <li>
              <button onClick={exportCSV} className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-700 text-left">
                <FileText size={16} /> CSV
              </button>
            </li>
            <li>
              <button onClick={exportExcel} className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-700 text-left">
                <FileSpreadsheet size={16} /> Excel
              </button>
            </li>
            <li>
              <button onClick={exportPDF} className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-700 text-left">
                <FileType size={16} /> PDF
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}