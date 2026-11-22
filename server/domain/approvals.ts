import type { Approval } from './types.ts'

/** Négy szem elve: ennyi KÜLÖNBÖZŐ jóváhagyó kell. */
export const REQUIRED_APPROVALS = 2
/** Ennyi forint felett az átvételi elszámoláshoz is két jóváhagyás kell. */
export const FOUR_EYES_SETTLEMENT_HUF = 1_000_000_000

export type ApprovalCheck = 'ok' | 'mar-jovahagyta' | 'javaslo'

/**
 * Jóváhagyhat-e a felhasználó: nem hagyhatta már jóvá, és a javaslattevő saját javaslatát nem hagyhatja jóvá.
 * A BFF mindkét háttérben ugyanezt a szabályt használja.
 */
export function checkApproval(approvals: Approval[], userId: string, proposerId?: string): ApprovalCheck {
  if (approvals.some(a => a.userId === userId)) return 'mar-jovahagyta'
  if (proposerId && proposerId === userId) return 'javaslo'
  return 'ok'
}

export const approvalMessage: Record<Exclude<ApprovalCheck, 'ok'>, string> = {
  'mar-jovahagyta': 'Ezt már jóváhagyta; a négy szem elve szerint másik személy jóváhagyása kell',
  'javaslo': 'A saját javaslatát nem hagyhatja jóvá; a négy szem elve szerint másik személy jóváhagyása kell',
}

export const needsFourEyes = (settlementHuf: number) => settlementHuf >= FOUR_EYES_SETTLEMENT_HUF
