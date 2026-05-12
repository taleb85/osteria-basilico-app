import { useState, useEffect, useRef } from 'react';
import { Upload, FileText, Trash2, Download, File, AlertCircle } from 'lucide-react';
import {
  uploadDocument,
  deleteDocument,
  listDocuments,
  getDocumentUrl,
  getCategoryLabel,
  getAllowedTypes,
  getMaxFileSize,
  validateFile,
  type StoredDocument,
  type DocumentCategory,
} from '../utils/documentStorage';

const CATEGORIES: DocumentCategory[] = ['contract', 'payroll', 'hr', 'other'];

interface DocumentManagerProps {
  userId: string;
  tenantId?: string;
}

export default function DocumentManager({ userId, tenantId }: DocumentManagerProps) {
  const [docs, setDocs] = useState<StoredDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory>('contract');
  const fileRef = useRef<HTMLInputElement>(null);
  const prefix = tenantId ? `${tenantId}/${userId}` : userId;

  useEffect(() => { loadDocs(); }, [prefix]);

  const loadDocs = async () => {
    setLoading(true);
    const all = await listDocuments(prefix);
    setDocs(all);
    setLoading(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setSuccess('');
    const validationErr = validateFile(file);
    if (validationErr) { setError(validationErr); return; }
    setUploading(true);
    const result = await uploadDocument(file, userId, selectedCategory, tenantId);
    setUploading(false);
    if (result.ok) {
      setSuccess('Documento caricato');
      await loadDocs();
    } else {
      setError(result.error);
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleDelete = async (path: string) => {
    if (!window.confirm('Eliminare questo documento?')) return;
    setError('');
    const ok = await deleteDocument(path);
    if (ok) {
      setDocs((prev) => prev.filter((d) => d.id !== path));
      setSuccess('Documento eliminato');
    } else {
      setError('Errore eliminazione');
    }
  };

  const handleDownload = async (doc: StoredDocument) => {
    const url = await getDocumentUrl(doc.id);
    if (url) window.open(url, '_blank');
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('it-IT'); } catch { return iso; }
  };

  const docsByCategory = CATEGORIES.map((cat) => ({
    category: cat,
    label: getCategoryLabel(cat),
    docs: docs.filter((d) => d.category === cat),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">Documenti</h3>
        <span className="text-[11px] text-white/50">{docs.length} documenti</span>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/15 px-3 py-2 text-[11px] text-red-300">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-emerald-500/15 px-3 py-2 text-[11px] text-emerald-300">{success}</div>
      )}

      <div className="flex items-center gap-2">
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value as DocumentCategory)}
          className="rounded-lg border border-neutral-500 bg-white/5 px-2 py-1.5 text-[11px] text-white/80"
        >
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{getCategoryLabel(cat)}</option>
          ))}
        </select>
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          <Upload className="h-3 w-3" />
          {uploading ? 'Caricamento…' : 'Carica'}
        </button>
        <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" className="hidden" onChange={handleUpload} />
      </div>

      <div className="text-[10px] text-white/40">
        Formati: PDF, JPEG, PNG, DOC, DOCX, XLS, XLSX. Max {Math.round(getMaxFileSize() / 1024 / 1024)} MB.
      </div>

      {loading ? (
        <div className="py-8 text-center text-[11px] text-white/50">Caricamento…</div>
      ) : docs.length === 0 ? (
        <div className="py-8 text-center text-[11px] text-white/40">Nessun documento caricato</div>
      ) : (
        <div className="space-y-4">
          {docsByCategory.map(({ category, label, docs: catDocs }) =>
            catDocs.length > 0 ? (
              <div key={category}>
                <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/50">{label}</h4>
                <div className="space-y-1">
                  {catDocs.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                      <FileText className="h-4 w-4 shrink-0 text-white/40" />
                      <span className="min-w-0 flex-1 truncate text-[11px] text-white/80" title={doc.name}>{doc.name}</span>
                      <span className="shrink-0 text-[10px] text-white/40">{formatSize(doc.size)}</span>
                      <span className="shrink-0 text-[10px] text-white/40">{formatDate(doc.uploaded_at)}</span>
                      <button type="button" onClick={() => handleDownload(doc)}
                        className="flex h-6 w-6 items-center justify-center rounded-lg hover:bg-white/10 transition-colors">
                        <Download className="h-3 w-3 text-white/60" />
                      </button>
                      <button type="button" onClick={() => handleDelete(doc.id)}
                        className="flex h-6 w-6 items-center justify-center rounded-lg hover:bg-red-500/20 transition-colors">
                        <Trash2 className="h-3 w-3 text-red-400" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}
