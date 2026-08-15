import * as React from "react";
import { createPortal } from "react-dom";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

const Dialog = React.forwardRef<HTMLDivElement, DialogProps>(({ 
  open, 
  onOpenChange, 
  children 
}, ref) => {
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };
    if (open) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, onOpenChange]);

  if (!open) return null;

  return createPortal(
    <div ref={ref} className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={(e) => onOpenChange(false)} />
      <div className="relative p-4 w-full max-w-2xl">
        <div 
          className="relative bg-white rounded-lg shadow dark:bg-ink-900"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
});

Dialog.displayName = "Dialog";

const DialogContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      tabIndex={-1}
      className={
        "flex h-full flex-col relative p-6 space-y-6 text-base outline-none dark:border-ink-600 " +
        (className ?? "")
      }
      {...props}
    >
      {children}
    </div>
  )
);

DialogContent.displayName = "DialogContent";

export { Dialog, DialogContent };