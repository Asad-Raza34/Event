import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';
import Icon from './Icon';
import { Button, IconButton, Spinner } from './primitives';

const SIZES = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' };

export const Modal = ({ open, onClose, title, subtitle, children, footer, size = 'md', closeOnBackdrop = true }) => {
  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-fade-in"
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn('relative z-10 w-full animate-fade-in overflow-hidden rounded-t-2xl bg-white shadow-pop sm:rounded-2xl dark:bg-slate-900', SIZES[size])}
      >
        {(title || onClose) && (
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-semibold">{title}</h2>
              {subtitle && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
            </div>
            <IconButton icon="x" label="Close" onClick={onClose} />
          </div>
        )}
        <div className="scroll-area max-h-[70vh] px-5 py-5">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-5 py-4 dark:border-slate-800">{footer}</div>}
      </div>
    </div>
  );
};

export const ConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  loading = false,
}) => (
  <Modal
    open={open}
    onClose={onClose}
    title={title}
    size="sm"
    footer={
      <>
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button variant={tone} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </>
    }
  >
    <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>
  </Modal>
);

export const Drawer = ({ open, onClose, title, children, side = 'right', width = 'max-w-md' }) => {
  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (event) => event.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex">
      <button type="button" aria-label="Close panel" className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <aside
        className={cn(
          'relative z-10 ml-auto flex h-full w-full flex-col bg-white shadow-pop dark:bg-slate-900',
          width,
          side === 'right' ? 'animate-slide-in' : 'mr-auto',
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h2 className="text-base font-semibold">{title}</h2>
          <IconButton icon="x" label="Close" onClick={onClose} />
        </div>
        <div className="scroll-area flex-1 p-5">{children}</div>
      </aside>
    </div>
  );
};

/** Click-outside dropdown used for menus and filters. */
export const Dropdown = ({ trigger, children, align = 'right', className }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handleClick = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    const handleKey = (event) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen((current) => !current)}>{trigger}</div>
      {open && (
        <div
          className={cn(
            'absolute z-50 mt-2 min-w-[200px] animate-fade-in overflow-hidden rounded-2xl border border-slate-200 bg-white py-1.5 shadow-pop dark:border-slate-700 dark:bg-slate-900',
            align === 'right' ? 'right-0' : 'left-0',
            className,
          )}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
};

export const DropdownItem = ({ icon, children, onClick, tone = 'default', disabled }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={cn(
      'flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition disabled:opacity-50',
      tone === 'danger'
        ? 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/50'
        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800',
    )}
  >
    {icon && <Icon name={icon} className="h-4 w-4" />}
    {children}
  </button>
);

export const LoadingOverlay = ({ label = 'Loading…' }) => (
  <div className="flex items-center justify-center gap-3 py-10 text-sm text-slate-500 dark:text-slate-400">
    <Spinner /> {label}
  </div>
);
