"use client";

import React, { useEffect, useState, createContext, useContext, useCallback } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
  createdAt: number;
}

type ToastListener = (toasts: ToastItem[]) => void;

class ToastManager {
  private toasts: ToastItem[] = [];
  private listeners: Set<ToastListener> = new Set();

  subscribe(listener: ToastListener) {
    this.listeners.add(listener);
    listener([...this.toasts]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const copy = [...this.toasts];
    this.listeners.forEach((listener) => listener(copy));
  }

  add(type: ToastType, message: string, options?: { title?: string; duration?: number }) {
    const id = "toast_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now();
    const duration = options?.duration ?? (type === "error" ? 5000 : 4000);
    const item: ToastItem = {
      id,
      type,
      title: options?.title ?? (type === "success" ? "Success" : type === "error" ? "Error" : type === "warning" ? "Notice" : "Information"),
      message,
      duration,
      createdAt: Date.now(),
    };

    // Keep max 5 toasts visible
    this.toasts = [item, ...this.toasts.slice(0, 4)];
    this.notify();

    if (duration > 0) {
      setTimeout(() => {
        this.remove(id);
      }, duration);
    }

    return id;
  }

  remove(id: string) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notify();
  }

  clear() {
    this.toasts = [];
    this.notify();
  }
}

export const toastManager = new ToastManager();

export const toast = {
  success: (message: string, options?: { title?: string; duration?: number }) =>
    toastManager.add("success", message, options),
  error: (message: string, options?: { title?: string; duration?: number }) =>
    toastManager.add("error", message, options),
  warning: (message: string, options?: { title?: string; duration?: number }) =>
    toastManager.add("warning", message, options),
  info: (message: string, options?: { title?: string; duration?: number }) =>
    toastManager.add("info", message, options),
  dismiss: (id: string) => toastManager.remove(id),
  clear: () => toastManager.clear(),
};

interface ToastProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

const ToastCard: React.FC<ToastProps> = ({ toast: item, onDismiss }) => {
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!item.duration || item.duration <= 0) return;
    const intervalTime = 50;
    const step = (intervalTime / item.duration) * 100;

    const timer = setInterval(() => {
      if (!isPaused) {
        setProgress((prev) => {
          if (prev <= 0) {
            clearInterval(timer);
            return 0;
          }
          return Math.max(0, prev - step);
        });
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [item.duration, isPaused]);

  const getTheme = () => {
    switch (item.type) {
      case "success":
        return {
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
          iconBg: "bg-emerald-100",
          border: "border-emerald-200",
          progressBg: "bg-emerald-500",
          glow: "shadow-emerald-500/10",
        };
      case "error":
        return {
          icon: <AlertCircle className="w-5 h-5 text-rose-600" />,
          iconBg: "bg-rose-100",
          border: "border-rose-200",
          progressBg: "bg-rose-500",
          glow: "shadow-rose-500/10",
        };
      case "warning":
        return {
          icon: <AlertTriangle className="w-5 h-5 text-amber-600" />,
          iconBg: "bg-amber-100",
          border: "border-amber-200",
          progressBg: "bg-amber-500",
          glow: "shadow-amber-500/10",
        };
      case "info":
      default:
        return {
          icon: <Info className="w-5 h-5 text-blue-600" />,
          iconBg: "bg-blue-100",
          border: "border-blue-200",
          progressBg: "bg-blue-500",
          glow: "shadow-blue-500/10",
        };
    }
  };

  const theme = getTheme();

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className={`relative overflow-hidden w-full max-w-sm sm:max-w-md bg-white/95 backdrop-blur-md border ${theme.border} rounded-xl shadow-xl ${theme.glow} transition-all duration-300 transform translate-y-0 opacity-100 hover:scale-[1.01] pointer-events-auto`}
      style={{
        animation: "toastHoverSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards",
      }}
    >
      <div className="flex items-start gap-3 p-3.5">
        <div className={`w-8 h-8 rounded-full ${theme.iconBg} flex items-center justify-center shrink-0 shadow-xs mt-0.5`}>
          {theme.icon}
        </div>

        <div className="flex-1 min-w-0 pr-2">
          {item.title && (
            <h4 className="text-xs font-bold text-slate-900 tracking-tight leading-snug">
              {item.title}
            </h4>
          )}
          <p className="text-xs text-slate-600 leading-relaxed mt-0.5 break-words">
            {item.message}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onDismiss(item.id)}
          className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1 rounded-md transition-colors shrink-0"
          title="Dismiss notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Progress countdown bar */}
      {item.duration && item.duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-100 overflow-hidden">
          <div
            className={`h-full ${theme.progressBg} transition-all duration-75 ease-linear`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    return toastManager.subscribe((newToasts) => {
      setToasts(newToasts);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed top-5 right-5 sm:right-6 z-[999999] flex flex-col gap-2.5 max-w-sm sm:max-w-md w-full pointer-events-none px-4 sm:px-0"
    >
      {toasts.map((item) => (
        <ToastCard
          key={item.id}
          toast={item}
          onDismiss={(id) => toastManager.remove(id)}
        />
      ))}
    </div>
  );
};
