export function cnpjValido(cnpj: string): boolean {
  const normalizado = cnpj.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  if (!/^[A-Z0-9]{12}[0-9]{2}$/.test(normalizado)) return false
  if (/^(.)\1{13}$/.test(normalizado)) return false

  const valores = [...normalizado].map((caractere) => caractere.charCodeAt(0) - 48)
  const pesosPrimeiroDigito = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const pesosSegundoDigito = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

  function calcularDigito(quantidade: number, pesos: number[]): number {
    const soma = valores
      .slice(0, quantidade)
      .reduce((total, valor, indice) => total + valor * pesos[indice], 0)
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }

  return valores[12] === calcularDigito(12, pesosPrimeiroDigito)
    && valores[13] === calcularDigito(13, pesosSegundoDigito)
}
