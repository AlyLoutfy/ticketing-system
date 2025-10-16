"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, AlertCircle, Info, X } from "lucide-react";

export interface ToastProps {
  id: string;
  title: string;
  description?: string;
  type: "success" | "error" | "warning" | "info";
  duration?: number;
}

interface ToastComponentProps extends ToastProps {
  onClose: (id: string) => void;
}

export function Toast({ id, title, description, type, duration = 5000, onClose }: ToastComponentProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, duration);

    return () => clearTimeout(timer);
  }, [id, duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case "success":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "error":
        return <XCircle className="w-5 h-5 text-red-600" />;
      case "warning":
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case "info":
        return <Info className="w-5 h-5 text-blue-600" />;
    }
  };

  const getBgColor = () => {
    switch (type) {
      case "success":
        return "bg-green-50 border-green-200";
      case "error":
        return "bg-red-50 border-red-200";
      case "warning":
        return "bg-yellow-50 border-yellow-200";
      case "info":
        return "bg-blue-50 border-blue-200";
    }
  };

  return (
    <div className={`fixed top-4 right-4 z-50 max-w-sm w-full ${getBgColor()} border rounded-lg shadow-lg p-4 animate-in slide-in-from-right duration-300`}>
      <div className="flex items-start gap-3">
        {getIcon()}
        <div className="flex-1">
          <h4 className="font-medium text-gray-900">{title}</h4>
          {description && <p className="text-sm text-gray-600 mt-1">{description}</p>}
        </div>
        <button onClick={() => onClose(id)} className="text-gray-400 hover:text-gray-600 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Client-side only toast manager
class ClientToastManager {
  private toasts: ToastProps[] = [];
  private listeners: ((toasts: ToastProps[]) => void)[] = [];
  private mounted = false;

  mount() {
    this.mounted = true;
  }

  unmount() {
    this.mounted = false;
  }

  subscribe(listener: (toasts: ToastProps[]) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener([...this.toasts]));
  }

  show(title: string, type: "success" | "error" | "warning" | "info", description?: string) {
    console.log("Toast show called:", { title, type, description, mounted: this.mounted });

    if (!this.mounted) {
      console.warn("Toast system not mounted yet");
      return;
    }

    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newToast: ToastProps = { id, title, type, description };

    this.toasts.push(newToast);
    console.log("Toast added, total toasts:", this.toasts.length);
    this.notify();

    // Auto-remove after duration
    setTimeout(() => {
      this.remove(id);
    }, 5000);
  }

  remove(id: string) {
    this.toasts = this.toasts.filter((toast) => toast.id !== id);
    this.notify();
  }
}

// Global instance
const toastManager = new ClientToastManager();

export function showToast(title: string, type: "success" | "error" | "warning" | "info", description?: string) {
  toastManager.show(title, type, description);
}

export function ClientToastContainer() {
  const [toasts, setToasts] = useState<ToastProps[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    console.log("ClientToastContainer mounting...");
    setMounted(true);
    toastManager.mount();
    console.log("ToastManager mounted");

    const unsubscribe = toastManager.subscribe(setToasts);

    return () => {
      console.log("ClientToastContainer unmounting...");
      unsubscribe();
      toastManager.unmount();
    };
  }, []);

  if (!mounted) {
    return null;
  }

  const removeToast = (id: string) => {
    toastManager.remove(id);
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onClose={removeToast} />
      ))}
    </div>
  );
}
