/**
 * Risolve /i/:slug → dipendente, salva il nome per il login,
 * reindirizza a /install?userId=xxx&firstName=Nome per mostrare le opzioni di installazione.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { buildUserInviteSlug } from '../config/appPaths';
import { useT } from '../hooks/useT';
import { FLOW_INVITE_NAME_STORAGE_KEY } from '../constants/appSession';

function cleanSlug(s: string | null | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

type SlimUser = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  pin?: string | null;
  tenant_id?: string | null;
};

type ResolveState =
  | { kind: 'loading' }
  | { kind: 'ready'; user: SlimUser }
  | { kind: 'notfound' };

export default function InviteRedirect() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<ResolveState>({ kind: 'loading' });
  const t = useT() as Record<string, string>;
  const tr = (key: string) => t[key] ?? key;

  useEffect(() => {
    if (!slug) {
      navigate('/install', { replace: true });
      return;
    }

    let cancelled = false;

    async function resolve() {
      try {
        if (!supabase) {
          if (!cancelled) setState({ kind: 'notfound' });
          return;
        }

        const usersRes = await supabase
          .from('users')
          .select('id, first_name, last_name, pin, tenant_id')
          .eq('status', 'active');

        if (cancelled) return;

        const allUsers: SlimUser[] = usersRes.data ?? [];

        const usersByTenant = new Map<string, SlimUser[]>();
        for (const u of allUsers) {
          const tid = u.tenant_id ?? '_none';
          if (!usersByTenant.has(tid)) usersByTenant.set(tid, []);
          usersByTenant.get(tid)!.push(u);
        }

        let matched: SlimUser | undefined;

        for (const [, tenantUsers] of usersByTenant) {
          const found = tenantUsers.find(
            (u) => buildUserInviteSlug(u, tenantUsers) === cleanSlug(slug)
          );
          if (found) {
            matched = found;
            break;
          }
        }

        if (!matched) {
          if (!cancelled) setState({ kind: 'notfound' });
          return;
        }

        const loginName = `${matched.first_name ?? ''} ${matched.last_name ?? ''}`.trim();
        if (loginName) {
          try {
            localStorage.setItem(FLOW_INVITE_NAME_STORAGE_KEY, loginName);
          } catch {
            /* ignore */
          }
        }

        // Reindirizza alla pagina di installazione con userId e firstName
        const firstName = encodeURIComponent((matched.first_name ?? '').trim());
        if (!cancelled) navigate(`/install?userId=${matched.id}&firstName=${firstName}`, { replace: true });
      } catch {
        if (!cancelled) setState({ kind: 'notfound' });
      }
    }

    void resolve();
    return () => {
      cancelled = true;
    };
  }, [slug, navigate]);

  useEffect(() => {
    if (state.kind === 'notfound') {
      navigate('/install', { replace: true });
    }
  }, [state.kind, navigate]);

  if (state.kind === 'notfound') return null;

  // Schermata di caricamento
  return (
    <div
      className="min-h-screen min-h-[100dvh] w-full flex flex-col items-center justify-center px-6 font-sans"
      style={{ background: 'transparent' }}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 w-full max-w-[320px] rounded-3xl overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.10)',
            backdropFilter: 'blur(24px)',
            boxShadow:
              '0 32px 64px -12px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04) inset',
          }}
        >
          <div className="flex flex-col items-center pt-10 pb-6 px-6">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="mb-5"
            >
              <img
                src="/icon-flow-final.png"
                alt="FLOW"
                draggable={false}
                style={{ width: 84, height: 84, borderRadius: 20, objectFit: 'contain' }}
              />
            </motion.div>
            <h1 className="text-[1.25rem] font-bold text-white tracking-tight mb-1.5 text-center">
              {tr('invite_welcome_title')}
            </h1>
            <p className="text-[0.8rem] text-white/45 text-center leading-relaxed">
              {tr('invite_verifying')}
            </p>
          </div>
          <div className="mx-5 h-px bg-white/[0.07]" />
          <div className="px-5 py-5">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-[#6699FF] animate-spin" strokeWidth={2.5} />
              </div>
              <span className="text-[0.8rem] font-medium text-white/65">{tr('invite_verifying')}</span>
            </div>
          </div>
          <div className="pb-6" />
        </motion.div>
        <p className="mt-8 text-white/20 text-xs font-semibold tracking-[0.2em] uppercase select-none">FLOW</p>
      </div>
    </div>
  );
}
