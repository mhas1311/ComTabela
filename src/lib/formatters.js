const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function formatMoney(value, hidden = false) {
  if (hidden) return 'R$ •••••'
  const numeric = Number(value)
  return brlFormatter.format(Number.isFinite(numeric) ? numeric : 0)
}

/**
 * Neutraliza prefixos perigosos que softwares de planilha interpretam como fórmulas
 * (=, +, -, @, tabulação, retorno de carro).
 */
export function sanitizeSpreadsheetCell(value) {
  if (value == null) return ''
  if (typeof value === 'number') return value
  const str = String(value)
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`
  }
  return str
}

export function escapeCSVField(value) {
  const safe = String(sanitizeSpreadsheetCell(value)).replace(/"/g, '""')
  return `"${safe}"`
}

export function translateAuthError(message) {
  if (!message) return 'Ocorreu um erro inesperado na autenticação.'
  const lower = message.toLowerCase()

  if (lower.includes('invalid login credentials')) {
    return 'E-mail ou senha incorretos. Verifique seus dados e tente novamente.'
  }
  if (lower.includes('email not confirmed')) {
    return 'Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada ou spam.'
  }
  if (lower.includes('user already registered')) {
    return 'Este e-mail já está cadastrado. Tente fazer login ou recuperar sua senha.'
  }
  if (lower.includes('password should be at least')) {
    return 'A senha deve ter pelo menos 6 caracteres.'
  }
  if (lower.includes('rate limit') || lower.includes('for security purposes')) {
    return 'Muitas tentativas em sequência. Aguarde alguns instantes antes de tentar novamente.'
  }
  if (lower.includes('unable to validate email') || lower.includes('invalid email')) {
    return 'Informe um endereço de e-mail válido.'
  }
  if (lower.includes('same_password') || lower.includes('different from the old password')) {
    return 'A nova senha deve ser diferente da senha atual.'
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return 'Falha de conexão com o servidor. Verifique sua internet.'
  }
  return message
}
