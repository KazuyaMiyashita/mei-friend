import type { VerovioOptions } from './plugins/VerovioPlugin'

export type VrvCommand =
  | { cmd: 'loadVerovio' }
  | { cmd: 'updateAll'; options: VerovioOptions; mei: string; pageNo: number }
  | { cmd: 'updateData'; mei: string; pageNo: number }
  | { cmd: 'changePage'; pageNo: number }
  | { cmd: 'setOptions'; options: VerovioOptions; pageNo: number }

export type VrvResponse =
  | { cmd: 'vrvLoaded' }
  | { cmd: 'updated'; svg: string; pageCount: number; pageNo: number }
  | { cmd: 'error'; message: string }
