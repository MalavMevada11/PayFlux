import * as React from "react"
import { X } from "lucide-react"

function Dialog({ open, onOpenChange, children }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in-0"
        onClick={() => onOpenChange(false)}
      />
      {/* Content */}
      <div className="relative z-50 w-full max-w-lg mx-4 animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-200">
        {children}
      </div>
    </div>
  );
}

function DialogContent({ children, className = "" }) {
  return (
    <div className={`bg-background rounded-xl border shadow-2xl max-h-[85vh] overflow-y-auto ${className}`}>
      {children}
    </div>
  );
}

function DialogHeader({ children, className = "" }) {
  return (
    <div className={`flex flex-col space-y-1.5 p-6 pb-4 ${className}`}>
      {children}
    </div>
  );
}

function DialogTitle({ children, className = "" }) {
  return (
    <h2 className={`text-lg font-semibold leading-none tracking-tight ${className}`}>
      {children}
    </h2>
  );
}

function DialogDescription({ children, className = "" }) {
  return (
    <p className={`text-sm text-muted-foreground ${className}`}>
      {children}
    </p>
  );
}

function DialogFooter({ children, className = "" }) {
  return (
    <div className={`flex justify-end gap-2 p-6 pt-4 ${className}`}>
      {children}
    </div>
  );
}

function DialogClose({ onOpenChange, children }) {
  return (
    <button
      onClick={() => onOpenChange(false)}
      className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
    >
      {children || <X className="h-4 w-4" />}
      <span className="sr-only">Close</span>
    </button>
  );
}

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose }
