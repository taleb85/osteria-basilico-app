import { Image as ImageIcon, Camera, FolderOpen } from 'lucide-react';

export type ProfilePhotoSourceLabels = {
  sheetAria: string;
  gallery: string;
  camera: string;
  files: string;
};

type Props = {
  open: boolean;
  labels: ProfilePhotoSourceLabels;
  onClose: () => void;
  onPickGallery: () => void;
  onPickCamera: () => void;
  onPickFiles: () => void;
  /** id per aria-controls dal pulsante fotocamera */
  menuId?: string;
};

/**
 * Menu compatto sotto la fotocamera: tema chiaro/scuro (html.dark).
 */
export default function ProfilePhotoSourceSheet({
  open,
  labels,
  onClose,
  onPickGallery,
  onPickCamera,
  onPickFiles,
  menuId = 'profile-photo-source-menu',
}: Props) {
  if (!open) return null;

  return (
    <ul
      id={menuId}
      role="menu"
      aria-label={labels.sheetAria}
      className="absolute right-0 top-[calc(100%+4px)] z-[80] min-w-[10.25rem] max-w-[min(14rem,calc(100vw-1.5rem))] overflow-hidden rounded-lg bg-white py-0.5 shadow-md dark:bg-neutral-900 dark:shadow-black/40"
    >
      <li role="none">
        <button
          type="button"
          role="menuitem"
          className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-[11px] font-medium leading-tight text-slate-800 transition-colors hover:bg-slate-50 active:bg-slate-100 dark:text-neutral-100 dark:hover:bg-white/5 dark:active:bg-white/10 touch-manipulation"
          onClick={() => {
            onPickGallery();
            onClose();
          }}
        >
          <ImageIcon className="h-3.5 w-3.5 shrink-0 text-slate-600 dark:text-neutral-400" strokeWidth={2} aria-hidden />
          <span className="leading-snug">{labels.gallery}</span>
        </button>
      </li>
      <li role="none">
        <button
          type="button"
          role="menuitem"
          className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-[11px] font-medium leading-tight text-slate-800 transition-colors hover:bg-slate-50 active:bg-slate-100 dark:text-neutral-100 dark:hover:bg-white/5 dark:active:bg-white/10 touch-manipulation"
          onClick={() => {
            onPickCamera();
            onClose();
          }}
        >
          <Camera className="h-3.5 w-3.5 shrink-0 text-slate-600 dark:text-neutral-400" strokeWidth={2} aria-hidden />
          <span className="leading-snug">{labels.camera}</span>
        </button>
      </li>
      <li role="none">
        <button
          type="button"
          role="menuitem"
          className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-[11px] font-medium leading-tight text-slate-800 transition-colors hover:bg-slate-50 active:bg-slate-100 dark:text-neutral-100 dark:hover:bg-white/5 dark:active:bg-white/10 touch-manipulation"
          onClick={() => {
            onPickFiles();
            onClose();
          }}
        >
          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-slate-600 dark:text-neutral-400" strokeWidth={2} aria-hidden />
          <span className="leading-snug">{labels.files}</span>
        </button>
      </li>
    </ul>
  );
}
