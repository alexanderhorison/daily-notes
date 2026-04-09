import { type FormEvent, useState } from "react";
import { BellRing, Eye, EyeOff } from "lucide-react";

type LoginViewProps = {
  appPassword: string;
  authStorageKey: string;
  onLogin: () => void;
};

export function LoginView({ appPassword, authStorageKey, onLogin }: LoginViewProps): JSX.Element {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  function handleLogin(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (password === appPassword) {
      localStorage.setItem(authStorageKey, "true");
      onLogin();
    } else {
      setError("Incorrect password. Please try again.");
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-white px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-red-50">
            <BellRing className="h-12 w-12 text-red-500" strokeWidth={1.5} />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Reminders</h1>
            <p className="mt-1 text-sm text-gray-400">Your daily focus, quietly organized.</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                placeholder="••••••"
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 pr-12 text-gray-900 placeholder:text-gray-300 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {error ? <p className="text-sm text-red-500">{error}</p> : null}
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-red-500 py-3 text-base font-semibold text-white transition-colors hover:bg-red-600 active:bg-red-700"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
}
