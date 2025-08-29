"use client";

import { useState, useRef } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { usePasswordEncoding } from "@/lib/usePasswordEncryption";
import ReCAPTCHA from "react-google-recaptcha";
import { getRecaptchaSiteKey } from "@/lib/recaptcha";

export default function LoginPage() {
  const router = useRouter();
  const { encodePassword } = usePasswordEncoding();
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  const [activeTab, setActiveTab] = useState<"google" | "email">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const siteKey = getRecaptchaSiteKey();

  const handleGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      // For OAuth providers, signIn automatically redirects to the provider
      // and NextAuth will handle the callback redirect
      await signIn("google", { 
        callbackUrl: "/management" // Redirect here after successful OAuth
      });
    } catch (e: any) {
      setError(e?.message || "Sign in failed");
      setLoading(false);
    }
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
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
      
      // Encode password before sending to NextAuth
      const encodedPassword = encodePassword(password);
      
      const res = await signIn("credentials", {
        redirect: false,
        email,
        password: encodedPassword,
      });
      if (res?.error) {
        setError("Invalid email or password");
        setLoading(false);
        if (siteKey && recaptchaRef.current) {
          recaptchaRef.current.reset();
        }
        return;
      }
      // On success, NextAuth will set the session; redirect to management
      router.replace("/rank");
    } catch (e: any) {
      setError(e?.message || "Sign in failed");
      setLoading(false);
      if (siteKey && recaptchaRef.current) {
        recaptchaRef.current.reset();
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pt-24 pb-12">
      <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
          <div className="px-8 py-8">
            <h1 className="text-2xl font-extrabold text-gray-900 mb-6">Sign in</h1>

            {/* Tabs */}
            <div className="flex space-x-2 mb-6">
              <button
                onClick={() => setActiveTab("email")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === "email" ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                Email
              </button>
              <button
                onClick={() => setActiveTab("google")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === "google" ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                Google (Kaia Internal Only)
              </button>
            </div>

            {activeTab === "email" ? (
              <form onSubmit={handleEmail} className="space-y-4">
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
                <div>
                  <label className="block text-sm font-medium text-gray-700">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 block w-full text-gray-600 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="••••••••"
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
                {error && (
                  <div className="text-sm text-red-600">{error}</div>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {loading ? "Signing in..." : "Sign in"}
                </button>
                <div className="text-sm text-gray-500 text-right">
                  <a href="/auth/reset-password" className="underline">Forgot password?</a>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Google sign-in is for Kaia internal use.
                </p>
                {error && (
                  <div className="text-sm text-red-600">{error}</div>
                )}
                <button
                  onClick={handleGoogle}
                  disabled={loading}
                  className="w-full flex justify-center items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 transition-colors"
                >
                  {loading ? "Redirecting..." : "Continue with Google"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


