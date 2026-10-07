import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

interface Toast { id: number; message: string; kind: 'ok' | 'error' }
const Ctx = createContext<(message: string, kind?: Toast['kind']) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((message: string, kind: Toast['kind'] = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((t) => [...t, { id, message, kind }]);
    setTimeout(() => setItems((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.message}</div>)}
      </div>
    </Ctx.Provider>
  );
}
