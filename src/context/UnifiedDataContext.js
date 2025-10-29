import { USE_SUPABASE } from '../config'

// On importe les deux implémentations
import * as Local from './DataContext'
import * as Remote from './DataContextSupabase'

// On exporte la bonne implémentation selon USE_SUPABASE
export const DataProvider = USE_SUPABASE ? Remote.DataProvider : Local.DataProvider
export const useData = USE_SUPABASE ? Remote.useData : Local.useData

// ActionTypes n'existe que côté local (réducteur). On le réexporte tel quel.
export const ActionTypes = Local.ActionTypes


