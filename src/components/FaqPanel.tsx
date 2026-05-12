import { useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';

interface FaqItem {
  q: string;
  a: string;
  category: string;
}

const FAQS: FaqItem[] = [
  { category: 'turni', q: 'Come creo un turno?', a: 'Clicca su una cella vuota nella griglia settimanale per aprire il form di creazione. Inserisci orario inizio/fine, reparto e note. Puoi anche usare i template per turni ricorrenti.' },
  { category: 'turni', q: 'Come pubblicare i turni al team?', a: 'Usa il pulsante "Pubblica" nella toolbar della griglia. I dipendenti riceveranno una notifica push e potranno vedere il turno nell\'app.' },
  { category: 'turni', q: 'Posso copiare turni da una settimana all\'altra?', a: 'Sì, dalla toolbar seleziona "Copia settimana precedente" o usa il drag&drop tenendo premuto Shift per copiare singoli turni.' },
  { category: 'timbratura', q: 'Come timbrare entrata e uscita?', a: 'Apri l\'app, seleziona il tuo nome e inserisci il PIN. Premi "Entrata" all\'arrivo e "Uscita" alla fine del turno. La geolocalizzazione conferma la presenza.' },
  { category: 'timbratura', q: 'Cosa succede se dimentico di timbrare?', a: 'Puoi registrare una timbratura manuale dal menu del turno. I manager ricevono una notifica di timbratura mancante dopo l\'orario previsto.' },
  { category: 'timbratura', q: 'Il GPS è obbligatorio?', a: 'No, il geofencing è configurabile dall\'admin. Puoi attivarlo solo per alcuni dipendenti o reparti, o disattivarlo completamente.' },
  { category: 'ferie', q: 'Come richiedo ferie?', a: 'Vai su "Ferie" nella navigazione, clicca "Nuova richiesta", seleziona date e tipo. Il manager riceve la richiesta e può approvarla o rifiutarla.' },
  { category: 'ferie', q: 'Come funziona l\'accumulo ferie?', a: 'Le ferie maturano automaticamente in base al contratto. Puoi vedere il saldo disponibile nella schermata ferie.' },
  { category: 'account', q: 'Come si accede?', a: 'Vai su https://flow-workinmotion.vercel.app/profilo, seleziona il tuo nome e inserisci il PIN. Non serve email o password.' },
  { category: 'account', q: 'Ho dimenticato il PIN. Cosa faccio?', a: 'Chiedi a un manager di resettare il PIN dal pannello di amministrazione. Il PIN è sempre gestito dal personale autorizzato.' },
  { category: 'account', q: 'Posso accedere con Face ID o impronta?', a: 'Sì, se il tuo dispositivo lo supporta. Dopo il primo login con PIN, puoi abilitare lo sblocco biometrico dalle impostazioni del profilo.' },
  { category: 'pagine', q: 'Come vengono calcolate le ore?', a: 'Le ore vengono calcolate dalle timbrature effettive (entrata/uscita), con detrazione automatica della pausa secondo le regole configurate per il tuo paese.' },
  { category: 'pagine', q: 'Come esportare i dati per le paghe?', a: 'Dalla sezione Statistiche o Timesheet, usa il pulsante "Esporta". Puoi scegliere CSV per Excel/contabilità o PDF firmato.' },
  { category: 'pagine', q: 'Esiste un\'API per integrazioni?', a: 'Sì, FLOW espone un\'API REST pubblica. Contatta il supporto per ricevere la tua API key e la documentazione completa.' },
  { category: 'supporto', q: 'Come contattare il supporto?', a: 'Scrivi a support@flow-workinmotion.vercel.app. Il supporto è gratuito e il team risponde in meno di 10 minuti negli orari lavorativi.' },
  { category: 'supporto', q: 'Ci sono guide o tutorial?', a: 'Sì, nella sezione "Risorse" trovi guide passo-passo, video tutorial e template per iniziare subito.' },
];

const CATEGORIES = [
  { key: 'turni', label: 'Turni' },
  { key: 'timbratura', label: 'Timbratura' },
  { key: 'ferie', label: 'Ferie' },
  { key: 'account', label: 'Account e accesso' },
  { key: 'pagine', label: 'Paghe e report' },
  { key: 'supporto', label: 'Supporto' },
];

export default function FaqPanel() {
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState<string | null>(null);

  const filtered = FAQS.filter((f) => {
    if (filterCat && f.category !== filterCat) return false;
    if (search) {
      const q = search.toLowerCase();
      return f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca nelle FAQ..."
          className="w-full rounded-xl border border-neutral-500 bg-white/5 pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilterCat(null)}
          className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${!filterCat ? 'bg-accent text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
        >
          Tutte
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            type="button"
            onClick={() => setFilterCat(cat.key)}
            className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${filterCat === cat.key ? 'bg-accent text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="space-y-1">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-white/40">Nessun risultato trovato</p>
        ) : filtered.map((item, i) => {
          const id = `faq-${i}`;
          const isOpen = openId === id;
          return (
            <div key={id} className="rounded-xl border border-white/10 overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : id)}
                className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold text-white/80 hover:bg-white/5 transition-colors"
              >
                <span>{item.q}</span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-white/40 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && (
                <div className="px-4 pb-3 text-sm text-white/60 leading-relaxed border-t border-white/10 pt-3">
                  {item.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
