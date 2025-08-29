"use client";

import { useEffect, useState, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { usePasswordEncoding } from "@/lib/usePasswordEncryption";
import ReCAPTCHA from "react-google-recaptcha";
import { getRecaptchaSiteKey } from "@/lib/recaptcha";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const { encodePassword } = usePasswordEncoding();
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const siteKey = getRecaptchaSiteKey();

  useEffect(() => {
    setMessage(null);
    setError(null);
  }, [token]);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "/api";

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      // Verify reCAPTCHA if site key is configured
      if (siteKey && recaptchaRef.current) {
        const recaptchaToken = recaptchaRef.current.getValue();
        if (!recaptchaToken) {
          setError("Please complete the reCAPTCHA");
          setLoading(false);
          return;
        }
        
        // Verify reCAPTCHA on server
        const recaptchaRes = await fetch('/api/verify-recaptcha', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: recaptchaToken }),
        });
        
        if (!recaptchaRes.ok) {
          setError("reCAPTCHA verification failed");
          setLoading(false);
          recaptchaRef.current.reset();
          return;
        }
      }
      
      const res = await fetch(`${apiBase}/email-auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok || !data?.status) {
        setError(data?.data || data?.message || "Failed to request reset");
        if (siteKey && recaptchaRef.current) {
          recaptchaRef.current.reset();
        }
      } else {
        setMessage("If the email exists, a reset link has been sent.");
      }
    } catch (e: any) {
      setError(e?.message || "Unexpected error");
      if (siteKey && recaptchaRef.current) {
        recaptchaRef.current.reset();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSet = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      if (!password || password.length < 8) {
        setError("Password must be at least 8 characters.");
        setLoading(false);
        return;
      }
      if (password !== confirm) {
        setError("Passwords do not match.");
        setLoading(false);
        return;
      }
      // Encode password before sending
      const encodedPassword = encodePassword(password);
      
      const res = await fetch(`${apiBase}/email-auth/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: encodedPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data?.status) {
        setError(data?.data || data?.message || "Failed to set password");
      } else {
        setMessage("Password updated. Redirecting to login...");
        setTimeout(() => router.push("/auth/login"), 1200);
      }
    } catch (e: any) {
      setError(e?.message || "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pt-24 pb-12">
      <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
          <div className="px-8 py-8">
            <h1 className="text-2xl font-extrabold text-gray-900 mb-6">
              {token ? "Set New Password" : "Reset Password"}
            </h1>

            {!token ? (
              <form onSubmit={handleRequest} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 block w-full text-gray-600 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="you@example.com"
                    required
                  />
                </div>
                {siteKey && (
                  <div className="flex justify-center">
                    <ReCAPTCHA
                      ref={recaptchaRef}
                      sitekey={siteKey}
                      theme="light"
                    />
                  </div>
                )}
                {error && <div className="text-sm text-red-600">{error}</div>}
                {message && <div className="text-sm text-green-600">{message}</div>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {loading ? "Sending..." : "Send Reset Link"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSet} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">New Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 block w-full text-gray-600 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="••••••••"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="mt-1 block w-full text-gray-600 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="••••••••"
                    required
                  />
                </div>
                {error && <div className="text-sm text-red-600">{error}</div>}
                {message && <div className="text-sm text-green-600">{message}</div>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {loading ? "Saving..." : "Set Password"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pt-24 pb-12 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}


