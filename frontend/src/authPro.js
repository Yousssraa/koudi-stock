const PRO_TOKEN_KEY = "koudi_pro_token";

let listeners = [];

// sessionStorage (not localStorage): the password is re-requested each time a
// new browser window/tab opens the Espace Pro, while internal navigation
// keeps the session within the same tab.
export function getProToken() {
  return sessionStorage.getItem(PRO_TOKEN_KEY);
}

export function setProToken(token) {
  if (token) sessionStorage.setItem(PRO_TOKEN_KEY, token);
  else sessionStorage.removeItem(PRO_TOKEN_KEY);
  emit();
}

export function clearProToken() {
  sessionStorage.removeItem(PRO_TOKEN_KEY);
  emit();
}

export function isProAuthenticated() {
  return Boolean(getProToken());
}

export function subscribeProAuth(listener) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function emit() {
  listeners.forEach((l) => l());
}
