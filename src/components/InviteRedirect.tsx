/**
 * Risolve /i/:slug → dipendente e tenant, salva il nome per il login, mostra
 * istruzioni PWA per il dispositivo corrente e link «Apri senza installare».
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { buildUserInviteSlug, PATH_PROFILO } from '../config/appPaths';
import { useT } from '../hooks/useT';
import { formatTrans } from '../utils/translations';
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

function getDeviceKind(): 'ios' | 'android' | 'mac' | 'windows' | 'other' {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Mac/.test(ua) && !/iPhone|iPad|iPod/.test(ua)) return 'mac';
  if (/Windows/.test(ua)) return 'windows';
  return 'other';
}

function getInstallStepKeys(
  k: 'ios' | 'android' | 'mac' | 'windows' | 'other'
): [string, string, string] {
  if (k === 'ios') {
    return ['invite_install_ios_1', 'invite_install_ios_2', 'invite_install_ios_3'];
  }
  if (k === 'android') {
    return [
      'invite_install_android_1',
      'invite_install_android_2',
      'invite_install_android_3',
    ];
  }
  if (k === 'mac') {
    return ['invite_install_mac_1', 'invite_install_mac_2', 'invite_install_mac_3'];
  }
  return ['invite_install_win_1', 'invite_install_win_2', 'invite_install_win_3'];
}

export default function InviteRedirect() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<ResolveState>({ kind: 'loading' });
  const t = useT() as Record<string, string>;
  const tr = (key: string) => t[key] ?? key;

  const deviceKind = useMemo(() => getDeviceKind(), []);
  const installKeys = useMemo(() => getInstallStepKeys(deviceKind), [deviceKind]);
  const stepCount = 3;

  useEffect(() => {
    if (!slug) {
      navigate(PATH_PROFILO, { replace: true });
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

        if (!cancelled) setState({ kind: 'ready', user: matched });
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
      navigate(PATH_PROFILO, { replace: true });
    }
  }, [state.kind, navigate]);

  if (state.kind === 'notfound') {
    return null;
  }

  if (state.kind === 'loading') {
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

  const { user } = state;
  const firstName = (user.first_name ?? '').trim();

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
          <div className="flex flex-col items-center pt-10 pb-4 px-6">
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
              {formatTrans(tr('invite_follow_n_steps'), { n: stepCount })}
            </p>
          </div>
          <div className="mx-5 h-px bg-white/[0.07]" />
          <ol className="px-5 py-5 space-y-3 list-decimal list-outside pl-7 pr-2 text-left marker:text-white/40">
            {installKeys.map((key) => (
              <li key={key} className="text-[0.8rem] font-medium text-white/80 leading-relaxed">
                {tr(key)}
              </li>
            ))}
          </ol>
          <div className="px-5 pb-2">
            <button
              type="button"
              onClick={() => {
                window.location.href = '/';
              }}
              className="w-full rounded-2xl py-3 text-sm font-bold text-center transition-colors"
              style={{
                background: 'rgba(102,153,255,0.2)',
                border: '1px solid rgba(102,153,255,0.4)',
                color: 'rgb(199, 210, 255)',
              }}
            >
              {tr('invite_open_without_install')}
            </button>
          </div>
          {firstName ? (
            <p className="px-5 pb-6 text-center text-[0.8rem] text-white/50 font-medium">
              {formatTrans(tr('invite_account_ready'), { name: firstName })}
            </p>
          ) : (
            <div className="pb-6" />
          )}
        </motion.div>
        <p className="mt-8 text-white/20 text-xs font-semibold tracking-[0.2em] uppercase select-none">FLOW</p>
      </div>
    </div>
  );
}
