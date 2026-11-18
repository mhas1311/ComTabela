import { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { ChevronDown, Download, FileSpreadsheet, FileText, FileType, Loader2 } from 'lucide-react'
import { formatDateBR } from '../lib/date'
import { escapeCSVField, formatMoney, sanitizeSpreadsheetCell } from '../lib/formatters'
import { useToast } from '../contexts/ToastContext'

export default function ExportButton({ transactions, filePrefix = 'comtabela_transacoes' }) {
  const [open, setOpen] = useState(false)
  const [exportingFormat, setExportingFormat] = useState('')
  const menuRef = useRef(null)
  const { toast } = useToast()

  useEffect(() => {
    if (!open) return undefined
    const handleOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    const handleEsc = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    window.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      window.removeEventListener('keydown', handleEsc)
    }
  }, [open])

  const getSituationLabel = (t) => {
    if (t.type === 'income') {
      return t.status === 'received' ? 'Recebido' : 'Pendente'
    }
    return t.status === 'paid' ? 'Pago' : 'Pendente'
  }

  const getTableData = () =>
    transactions.map((t) => ({
      dateLabel: formatDateBR(t.date),
      description: String(t.description || ''),
      category: String(t.category?.name || 'Sem categoria'),
      account: String(t.accountName || 'Conta Principal'),
      type: t.type === 'income' ? 'Receita' : 'Despesa',
      situation: getSituationLabel(t),
      amountNum: Number(t.amount) || 0,
      amountFormatted: formatMoney(t.amount),
    }))

  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)

  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)

  const balance = totalIncome - totalExpense

  const exportCSV = () => {
    if (!transactions.length) {
      toast({ title: 'Nenhum lançamento para exportar', variant: 'info' })
      setOpen(false)
      return
    }

    const rows = getTableData()
    const headers = ['Data', 'Descrição', 'Categoria', 'Conta', 'Tipo', 'Situação', 'Valor']
    const csvRows = [headers.map(escapeCSVField).join(';')]

    rows.forEach((row) => {
      csvRows.push(
        [
          row.dateLabel,
          row.description,
          row.category,
          row.account,
          row.type,
          row.situation,
          row.amountFormatted,
        ]
          .map(escapeCSVField)
          .join(';')
      )
    })

    csvRows.push('')
    csvRows.push([escapeCSVField('RESUMO'), '', '', '', '', '', ''].join(';'))
    csvRows.push([escapeCSVField('Receitas'), '', '', '', '', '', escapeCSVField(formatMoney(totalIncome))].join(';'))
    csvRows.push([escapeCSVField('Despesas'), '', '', '', '', '', escapeCSVField(formatMoney(totalExpense))].join(';'))
    csvRows.push([escapeCSVField('Saldo'), '', '', '', '', '', escapeCSVField(formatMoney(balance))].join(';'))

    const csvContent = '\uFEFF' + csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${filePrefix}.csv`
    link.click()
    URL.revokeObjectURL(url)
    setOpen(false)
    toast({ title: 'CSV exportado com sucesso', description: `${rows.length} lançamentos incluídos.` })
  }

  const exportExcel = async () => {
    if (!transactions.length) {
      toast({ title: 'Nenhum lançamento para exportar', variant: 'info' })
      setOpen(false)
      return
    }

    try {
      setExportingFormat('xlsx')
      const { default: writeXlsxFile } = await import('write-excel-file/browser')
      const rows = getTableData()

      const headerRow = ['Data', 'Descrição', 'Categoria', 'Conta', 'Tipo', 'Situação', 'Valor (R$)'].map(
        (label) => ({
          value: label,
          fontWeight: 'bold',
          backgroundColor: '#10b981',
          color: '#ffffff',
        })
      )

      const dataRows = rows.map((r) => [
        { type: String, value: sanitizeSpreadsheetCell(r.dateLabel) },
        { type: String, value: sanitizeSpreadsheetCell(r.description) },
        { type: String, value: sanitizeSpreadsheetCell(r.category) },
        { type: String, value: sanitizeSpreadsheetCell(r.account) },
        { type: String, value: sanitizeSpreadsheetCell(r.type) },
        { type: String, value: sanitizeSpreadsheetCell(r.situation) },
        { type: Number, value: r.type === 'Despesa' ? -Math.abs(r.amountNum) : r.amountNum, format: '#,##0.00' },
      ])

      const summaryRows = [
        [],
        [{ type: String, value: 'RESUMO DO PERÍODO', fontWeight: 'bold' }],
        [
          { type: String, value: 'Receitas' },
          null,
          null,
          null,
          null,
          null,
          { type: Number, value: totalIncome, format: '#,##0.00', fontWeight: 'bold' },
        ],
        [
          { type: String, value: 'Despesas' },
          null,
          null,
          null,
          null,
          null,
          { type: Number, value: -Math.abs(totalExpense), format: '#,##0.00', fontWeight: 'bold' },
        ],
        [
          { type: String, value: 'Saldo Líquido', fontWeight: 'bold' },
          null,
          null,
          null,
          null,
          null,
          { type: Number, value: balance, format: '#,##0.00', fontWeight: 'bold' },
        ],
      ]

      await writeXlsxFile([headerRow, ...dataRows, ...summaryRows], {
        sheet: 'Transações',
        columns: [
          { width: 13 },
          { width: 32 },
          { width: 18 },
          { width: 18 },
          { width: 12 },
          { width: 13 },
          { width: 16 },
        ],
      }).toFile(`${filePrefix}.xlsx`)

      setOpen(false)
      toast({ title: 'Planilha Excel gerada', description: `${rows.length} lançamentos exportados.` })
    } catch (err) {
      console.error('Erro ao exportar Excel:', err)
      toast({ title: 'Falha ao gerar Excel', description: 'Tente novamente em instantes.', variant: 'error' })
    } finally {
      setExportingFormat('')
    }
  }

  const exportPDF = async () => {
    if (!transactions.length) {
      toast({ title: 'Nenhum lançamento para exportar', variant: 'info' })
      setOpen(false)
      return
    }

    try {
      setExportingFormat('pdf')
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ])
      const rows = getTableData()
      const doc = new jsPDF()

      doc.setFontSize(15)
      doc.text('ComTabela — Relatório de Transações', 14, 16)
      doc.setFontSize(9)
      doc.setTextColor(100)
      doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')} · ${rows.length} registros`, 14, 22)

      autoTable(doc, {
        startY: 27,
        head: [['Data', 'Descrição', 'Categoria', 'Conta', 'Tipo', 'Situação', 'Valor']],
        body: rows.map((d) => [
          d.dateLabel,
          d.description,
          d.category,
          d.account,
          d.type,
          d.situation,
          d.amountFormatted,
        ]),
        styles: { fontSize: 8.5, cellPadding: 2.5 },
        headStyles: { fillColor: [16, 185, 129], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 247, 250] },
      })

      const finalY = (doc.lastAutoTable?.finalY || 30) + 10
      doc.setTextColor(20)
      doc.setFontSize(10.5)
      doc.text(`Receitas: ${formatMoney(totalIncome)}`, 14, finalY)
      doc.text(`Despesas: ${formatMoney(totalExpense)}`, 14, finalY + 6)
      doc.text(`Saldo: ${formatMoney(balance)}`, 14, finalY + 12)

      doc.save(`${filePrefix}.pdf`)
      setOpen(false)
      toast({ title: 'PDF exportado com sucesso', description: `${rows.length} lançamentos incluídos.` })
    } catch (err) {
      console.error('Erro ao exportar PDF:', err)
      toast({ title: 'Falha ao gerar PDF', description: 'Tente novamente em instantes.', variant: 'error' })
    } finally {
      setExportingFormat('')
    }
  }

  return (
    <div ref={menuRef} className="relative inline-block">
      <button
        type="button"
        id="btn-export-menu"
        onClick={() => setOpen((prev) => !prev)}
        disabled={Boolean(exportingFormat)}
        className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 px-3.5 py-2 rounded-xl text-sm font-medium text-slate-200 transition-colors cursor-pointer disabled:opacity-60"
      >
        {exportingFormat ? <Loader2 size={16} className="animate-spin text-emerald-400" /> : <Download size={16} />}
        <span>Exportar</span>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-700/90 rounded-xl shadow-2xl z-30 py-1.5 toast-enter">
          <button
            type="button"
            id="btn-export-csv"
            onClick={exportCSV}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-slate-200 hover:bg-slate-800 text-left transition-colors cursor-pointer"
          >
            <FileText size={16} className="text-sky-400" />
            <span>Arquivo CSV</span>
          </button>
          <button
            type="button"
            id="btn-export-xlsx"
            onClick={exportExcel}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-slate-200 hover:bg-slate-800 text-left transition-colors cursor-pointer"
          >
            <FileSpreadsheet size={16} className="text-emerald-400" />
            <span>Planilha Excel (.xlsx)</span>
          </button>
          <button
            type="button"
            id="btn-export-pdf"
            onClick={exportPDF}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-slate-200 hover:bg-slate-800 text-left transition-colors cursor-pointer"
          >
            <FileType size={16} className="text-amber-400" />
            <span>Relatório PDF</span>
          </button>
        </div>
      )}
    </div>
  )
}

ExportButton.propTypes = {
  transactions: PropTypes.arrayOf(PropTypes.object).isRequired,
  filePrefix: PropTypes.string,
}
