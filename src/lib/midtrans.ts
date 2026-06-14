type MidtransEnvironment = "sandbox" | "production";

type SnapCallbacks = {
  onSuccess?: (result: unknown) => void;
  onPending?: (result: unknown) => void;
  onError?: (result: unknown) => void;
  onClose?: () => void;
};

declare global {
  interface Window {
    snap?: {
      pay: (token: string, callbacks?: SnapCallbacks) => void;
    };
  }
}

let snapLoader: Promise<NonNullable<Window["snap"]>> | null = null;

function getSnapScriptUrl(environment: MidtransEnvironment) {
  return environment === "production"
    ? "https://app.midtrans.com/snap/snap.js"
    : "https://app.sandbox.midtrans.com/snap/snap.js";
}

export async function loadMidtransSnap(params: {
  clientKey: string;
  environment: MidtransEnvironment;
}) {
  if (window.snap) return window.snap;
  if (snapLoader) return snapLoader;

  snapLoader = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-midtrans-snap="true"]');
    if (existing) {
      existing.addEventListener("load", () => {
        if (window.snap) resolve(window.snap);
        else reject(new Error("Snap Midtrans gagal dimuat."));
      });
      existing.addEventListener("error", () => reject(new Error("Script Snap Midtrans gagal dimuat.")));
      return;
    }

    const script = document.createElement("script");
    script.src = getSnapScriptUrl(params.environment);
    script.dataset.clientKey = params.clientKey;
    script.dataset.midtransSnap = "true";
    script.setAttribute("data-client-key", params.clientKey);
    script.async = true;

    script.onload = () => {
      if (window.snap) resolve(window.snap);
      else reject(new Error("Snap Midtrans gagal dimuat."));
    };

    script.onerror = () => {
      reject(new Error("Script Snap Midtrans gagal dimuat."));
    };

    document.body.appendChild(script);
  });

  return snapLoader;
}

export async function startMidtransSnapPayment(params: {
  token: string;
  clientKey: string;
  environment: MidtransEnvironment;
  callbacks?: SnapCallbacks;
}) {
  const snap = await loadMidtransSnap({
    clientKey: params.clientKey,
    environment: params.environment,
  });

  snap.pay(params.token, params.callbacks);
}
