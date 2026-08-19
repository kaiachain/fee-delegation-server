"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pt-24 pb-12">
      <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
          <div className="px-8 py-8">
            <h1 className="text-2xl font-extrabold text-gray-900 mb-6">Sign in</h1>

            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Sign in with your Kaia Google account. Access is limited to
                approved administrators.
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
          </div>
        </div>
      </div>
    </div>
  );
}
