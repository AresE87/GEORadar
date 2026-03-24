import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr';

let browserClient: ReturnType<typeof createSupabaseBrowserClient> | null = null;

export function createBrowserClient() {
  if (browserClient) return browserClient;

  browserClient = createSupabaseBrowserClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY
  );

  return browserClient;
}

export type BrowserClient = ReturnType<typeof createBrowserClient>;
