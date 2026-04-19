/**
 * Risolve un link breve /i/:slug → cerca il dipendente globalmente su tutti i tenant
 * → redirige a /profilo?t=<token-con-tenantSlug>.
 *
 * Mostra una schermata elegante con progress steps mentre risolve lo slug.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { buildUserInviteSlug, buildProfiloAccessLink, PATH_PROFILO } from '../config/appPaths';

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

type Step = 'verifying' | 'verified' | 'redirecting';

export default function InviteRedirect() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('verifying');

  useEffect(() => {
    if (!slug) {
      navigate(PATH_PROFILO, { replace: true });
      return;
    }

    async function resolve() {
      try {
        if (!supabase) {
          navigate(PATH_PROFILO, { replace: true });
          return;
        }

        const [usersRes, tenantsRes] = await Promise.all([
          supabase
            .from('users')
            .select('id, first_name, last_name, pin, tenant_id')
            .eq('status', 'active'),
          supabase
            .from('tenants')
            .select('id, slug')
            .eq('is_active', true),
        ]);

        const allUsers: SlimUser[] = usersRes.data ?? [];
        const tenantSlugMap = new Map<string, string>(
          (tenantsRes.data ?? []).map((t: { id: string; slug: string }) => [t.id, t.slug])
        );

        const usersByTenant = new Map<string, SlimUser[]>();
        for (const u of allUsers) {
          const tid = u.tenant_id ?? '_none';
          if (!usersByTenant.has(tid)) usersByTenant.set(tid, []);
          usersByTenant.get(tid)!.push(u);
        }

        let matched: SlimUser | undefined;
        let matchedTenantSlug = '';

        for (const [tenantId, tenantUsers] of usersByTenant) {
          const found = tenantUsers.find(
            (u) => buildUserInviteSlug(u, tenantUsers) === cleanSlug(slug)
          );
          if (found) {
            matched = found;
            matchedTenantSlug = tenantSlugMap.get(tenantId) ?? '';
            break;
          }
        }

        if (!matched) {
          navigate(PATH_PROFILO, { replace: true });
          return;
        }

        // Invito trovato — aggiorna gli step visivi
        setStep('verified');
        await new Promise((r) => setTimeout(r, 700));
        setStep('redirecting');
        await new Promise((r) => setTimeout(r, 800));

        const link = buildProfiloAccessLink(matched.id, undefined, {
          displayName: `${matched.first_name ?? ''} ${matched.last_name ?? ''}`.trim(),
          pin: matched.pin ?? '',
          tenantSlug: matchedTenantSlug,
        });

        const url = new URL(link, window.location.origin);
        navigate(url.pathname + url.search, { replace: true });
      } catch {
        navigate(PATH_PROFILO, { replace: true });
      }
    }

    resolve();
  }, [slug, navigate]);

  const stepsDone = {
    verified: step === 'verified' || step === 'redirecting',
    redirecting: step === 'redirecting',
  };

  return (
    <div
      className="min-h-screen min-h-[100dvh] w-full flex flex-col items-center justify-center px-6 font-sans"
      style={{
        background:
          'radial-gradient(ellipse at 50% 30%, rgba(51,102,204,0.35) 0%, transparent 55%), #000010',
      }}
    >
      {/* Glow blob */}
      <div
        className="pointer-events-none absolute top-[20%] left-1/2 -translate-x-1/2 w-[340px] h-[340px] rounded-full opacity-25 blur-[80px]"
        style={{ background: 'radial-gradient(circle, #3366CC 0%, transparent 70%)' }}
      />

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-[320px] rounded-3xl overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.10)',
          backdropFilter: 'blur(24px)',
          boxShadow: '0 32px 64px -12px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04) inset',
        }}
      >
        {/* App icon */}
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

          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.4 }}
            className="text-[1.25rem] font-bold text-white tracking-tight mb-1.5 text-center"
          >
            Sei stato invitato
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.4 }}
            className="text-[0.8rem] text-white/45 text-center leading-relaxed"
          >
            Accedi con le credenziali ricevute
          </motion.p>
        </div>

        {/* Divider */}
        <div className="mx-5 h-px bg-white/[0.07]" />

        {/* Steps */}
        <div className="px-5 py-5 space-y-3">
          <StepRow
            label="Verifica invito in corso…"
            doneLabel="Invito verificato"
            done={stepsDone.verified}
            active={step === 'verifying'}
            delay={0.45}
          />
          <StepRow
            label="Reindirizzamento al login…"
            doneLabel="Reindirizzamento al login…"
            done={false}
            active={step === 'redirecting'}
            delay={0.55}
            hidden={step === 'verifying'}
          />
        </div>

        {/* Bottom padding */}
        <div className="pb-6" />
      </motion.div>

      {/* Logo sotto */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="mt-8 text-white/20 text-xs font-semibold tracking-[0.2em] uppercase select-none"
      >
        FLOW
      </motion.div>
    </div>
  );
}

function StepRow({
  label,
  doneLabel,
  done,
  active,
  delay,
  hidden = false,
}: {
  label: string;
  doneLabel: string;
  done: boolean;
  active: boolean;
  delay: number;
  hidden?: boolean;
}) {
  if (hidden) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="flex items-center gap-3"
    >
      {/* Icona stato */}
      <div className="relative flex-shrink-0 w-5 h-5">
        <AnimatePresence mode="wait">
          {done ? (
            <motion.div
              key="check"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(51,204,102,0.25)', border: '1px solid rgba(51,204,102,0.5)' }}
            >
              <Check className="w-3 h-3 text-emerald-400" strokeWidth={2.5} />
            </motion.div>
          ) : active ? (
            <motion.div
              key="spinner"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-5 h-5 flex items-center justify-center"
            >
              <Loader2 className="w-4 h-4 text-[#6699FF] animate-spin" strokeWidth={2} />
            </motion.div>
          ) : (
            <div
              key="idle"
              className="w-5 h-5 rounded-full"
              style={{ border: '1.5px solid rgba(255,255,255,0.15)' }}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Label */}
      <span
        className="text-[0.8rem] font-medium transition-colors duration-300"
        style={{ color: done ? 'rgba(255,255,255,0.85)' : active ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.3)' }}
      >
        {done ? doneLabel : label}
      </span>
    </motion.div>
  );
}
