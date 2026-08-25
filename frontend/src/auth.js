const TOKEN_KEY = "koudi_token";

let listeners = [];

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
  emit();
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  emit();
}

export function isAuthenticated() {
  return Boolean(getToken());
}

export function subscribeAuth(listener) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function emit() {
  listeners.forEach((l) => l());
}
