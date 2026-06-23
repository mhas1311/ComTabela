import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

function createDummyQuery() {
  const response = { data: [], error: null }
  const query = {
    select: () => query,
    insert: () => query,
    delete: () => query,
    eq: () => query,
    order: () => query,
    then: (resolve, reject) => Promise.resolve(response).then(resolve, reject),
    catch: (reject) => Promise.resolve(response).catch(reject),
    finally: (fn) => Promise.resolve(response).finally(fn),
  }
  return query
}

function createDummySupabase() {
  return {
    from: () => createDummyQuery(),
    auth: {
      onAuthStateChange: (callback) => {
        callback(null, null)
        return { subscription: { unsubscribe: () => {} } }
      },
      signInWithPassword: async () => ({ data: null, error: { message: 'Supabase não configurado' } }),
      signUp: async () => ({ data: null, error: { message: 'Supabase não configurado' } }),
      signOut: async () => ({ data: null, error: { message: 'Supabase não configurado' } }),
    },
  }
}

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createDummySupabase()

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase não está configurado. Crie .env.local com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para usar o app completo.'
  )
}