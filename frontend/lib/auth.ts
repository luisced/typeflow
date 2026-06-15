export interface AuthUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  createdAt: string;
}

type Listener = () => void;

let user: AuthUser | null = null;
const listeners = new Set<Listener>();

export function getUser(): AuthUser | null {
  return user;
}

export function setSession(next: AuthUser | null): void {
  user = next;
  listeners.forEach((cb) => cb());
}

export function clearSession(): void {
  setSession(null);
}

export function subscribe(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
