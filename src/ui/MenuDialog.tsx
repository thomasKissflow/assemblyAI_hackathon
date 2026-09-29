import { useEffect, useId, useRef, type RefObject } from 'react';
import './MenuDialog.css';

/**
 * Shows a native <dialog> as a modal while `open` is true, focuses its `[data-autofocus]` element, and gives focus
 * back to wherever it was when the dialog closes. Where showModal is missing (jsdom) it falls back to a plain open dialog.
 */
export function useModalDialog(ref: RefObject<HTMLDialogElement | null>, open: boolean) {
  const back = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      back.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
      d.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    } else if (!open && d.open) {
      if (typeof d.close === 'function') d.close();
      else d.removeAttribute('open');
      const el = back.current;
      back.current = null;
      if (el?.isConnected) el.focus();
    }
  }, [open, ref]);
}

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** A small "are you sure?" for deleting the cook's own things. The safe choice has focus. */
export function ConfirmDialog({ open, title, body, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useModalDialog(ref, open);
  return (
    <dialog
      ref={ref}
      className="confirm-dialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-body`}
      onCancel={e => {
        e.preventDefault();
        onCancel();
      }}
    >
      <h2 id={`${id}-title`} className="confirm-title">
        {title}
      </h2>
      <p id={`${id}-body`} className="confirm-body">
        {body}
      </p>
      <div className="confirm-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel} data-autofocus>
          Keep it
        </button>
        <button type="button" className="btn btn-danger" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
