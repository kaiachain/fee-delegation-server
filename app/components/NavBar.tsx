"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { fetchData } from "@/lib/apiUtils";
import { useRouter, usePathname } from "next/navigation";
import { formatBalance } from "@/lib/balanceUtils";

// Environment variables for pool balance thresholds (in KAIA)
const POOL_WARNING_RED = Number(process.env.NEXT_PUBLIC_POOL_WARNING_RED) || 10;
const POOL_WARNING_ORANGE = Number(process.env.NEXT_PUBLIC_POOL_WARNING_ORANGE) || 20;

// Convert KAIA thresholds to wei for comparison
const POOL_WARNING_RED_WEI = POOL_WARNING_RED * 10 ** 18;
const POOL_WARNING_ORANGE_WEI = POOL_WARNING_ORANGE * 10 ** 18;

export default function NavBar() {
  const [isVisible, setIsVisible] = useState(false);
  const [poolBalance, setPoolBalance] = useState(null);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const defaultProfilePic = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffffff'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/%3E%3C/svg%3E";

  const updateTime = () => {
    const now = new Date();
    const kstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // Add 9 hours for KST
    setCurrentTime(kstTime.toLocaleString("ko-KR", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).replace(/\s/g, '')); // Remove all spaces
  };

  const getPoolBalance = async () => {
    const result = await fetchData("/pool", { method: "GET" }, session);
    if (!result.status) return;
    setPoolBalance(result.data);
  };

  const toggleDropdown = () => setIsVisible(!isVisible);
  const handleImageError = () => setProfileImage(defaultProfilePic);

  const handleSignOut = async () => {
    try {
      await signOut({ 
        redirect: false
      });
      // Use router.push after a small delay to ensure signout completes
      setTimeout(() => {
        router.push('/rank');
      }, 100);
    } catch (error) {
      console.error('Signout error:', error);
      // Fallback to direct navigation
      router.push('/rank');
    }
  };

  useEffect(() => {
    setMounted(true);
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (session?.sessionExpired) {
      signOut({ redirect: false });
      return;
    }
    if (session) {
      getPoolBalance();
      if (session.user?.image) {
        setProfileImage(session.user.image);
      }
    }
  }, [session]);

  // Prevent hydration mismatch by not rendering anything until mounted
  if (!mounted) {
    return (
      <nav className="bg-gradient-to-r from-gray-800 via-gray-900 to-gray-800 shadow-lg fixed top-0 w-screen z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between">
            {/* Logo Section */}
            <div className="flex-shrink-0">
              <Link href="rank" className="group flex items-center">
                <span className="text-white text-2xl font-extrabold tracking-tight group-hover:text-blue-400 transition-colors duration-200">
                  Gas Fee Delegation
                </span>
                <span className="text-blue-400 text-xl font-bold ml-2 group-hover:text-white transition-colors duration-200">
                  | kaia
                </span>
              </Link>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="bg-gradient-to-r from-gray-800 via-gray-900 to-gray-800 shadow-lg fixed top-0 w-screen z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-16 flex items-center justify-between">
          {/* Logo Section */}
          <div className="flex-shrink-0">
            <Link href="rank" className="group flex items-center">
              <span className="text-white text-2xl font-extrabold tracking-tight group-hover:text-blue-400 transition-colors duration-200">
                Gas Fee Delegation
              </span>
              <span className="text-blue-400 text-xl font-bold ml-2 group-hover:text-white transition-colors duration-200">
                | kaia
              </span>
            </Link>
          </div>

          {/* Right Section - Navigation Links and User Profile */}
          <div className="flex items-center space-x-6">
            {/* KST Clock - Only show for logged in users */}
            {status === "authenticated" && (
              <div className="hidden md:flex items-center space-x-2 bg-gray-800/50 backdrop-blur-sm px-4 py-2 rounded-lg border border-gray-700">
                <div className="p-1.5 bg-blue-50 rounded-md">
                  <svg className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-gray-400">KST</span>
                  <span className="text-sm font-mono text-blue-400">{currentTime}</span>
                </div>
              </div>
            )}

            {/* Navigation Links */}
            <nav className="hidden md:flex space-x-4">
              <Link
                className={`p-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center ${
                  pathname === '/rank'
                    ? 'text-white bg-gray-700/50'
                    : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                }`}
                href="/rank"
                title="Rank"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </Link>
              {status === "authenticated" && session?.user?.role === "editor" && (
                <>
                  <Link
                    className={`p-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center ${
                      pathname === '/management'
                        ? 'text-white bg-gray-700/50'
                        : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                    }`}
                    href="/management"
                    title="Management"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </Link>
                  <Link
                    className={`p-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center ${
                      pathname === '/email-alerts'
                        ? 'text-white bg-gray-700/50'
                        : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                    }`}
                    href="/email-alerts"
                    title="Email Alerts"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </Link>
                </>
              )}
            </nav>

            {/* User Section */}
            <div className="flex items-center space-x-4">
              {status === "authenticated" ? (
                <>
                  {/* Pool Balance */}
                  {poolBalance && (
                    <div className="hidden sm:flex items-center group">
                      <div className="relative bg-gray-800/50 backdrop-blur-sm px-4 py-2 rounded-lg border border-gray-700 hover:border-blue-500/50 transition-all duration-300">
                        <div className="flex items-center space-x-3">
                          <div className="relative">
                            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                              </svg>
                            </div>
                            <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ring-2 ring-gray-800 ${
                              Number(poolBalance) > POOL_WARNING_ORANGE_WEI 
                                ? 'bg-green-400' 
                                : Number(poolBalance) > POOL_WARNING_RED_WEI 
                                  ? 'bg-orange-400' 
                                  : 'bg-red-400'
                            }`}>
                              <div className={`w-full h-full rounded-full animate-ping opacity-75 ${
                                Number(poolBalance) > POOL_WARNING_ORANGE_WEI 
                                  ? 'bg-green-400' 
                                  : Number(poolBalance) > POOL_WARNING_RED_WEI 
                                    ? 'bg-orange-400' 
                                    : 'bg-red-400'
                              }`}></div>
                            </div>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs text-gray-400 group-hover:text-blue-400 transition-colors duration-200">Fee Pool</span>
                            <span className={`text-sm font-semibold group-hover:text-blue-100 transition-colors duration-200 ${
                              Number(poolBalance) > POOL_WARNING_ORANGE_WEI 
                                ? 'text-green-400' 
                                : Number(poolBalance) > POOL_WARNING_RED_WEI 
                                  ? 'text-orange-400' 
                                  : 'text-red-400'
                            }`}>{formatBalance(poolBalance)} KAIA</span>
                          </div>
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg"></div>
                      </div>
                    </div>
                  )}

                  {/* User Email */}
                  <span 
                    className="hidden lg:block text-gray-300 text-sm font-medium max-w-[200px] truncate" 
                    title={session?.user?.email ?? ''}
                  >
                    {session?.user?.email}
                  </span>

                  {/* Profile Dropdown */}
                  <div className="relative">
                    <button
                      onClick={toggleDropdown}
                      className="bg-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 transition-all duration-200 hover:ring-2 hover:ring-blue-400"
                    >
                      <img
                        className="h-8 w-8 rounded-full border-2 border-gray-600 hover:border-blue-400 transition-colors duration-200"
                        src={profileImage || defaultProfilePic}
                        alt="Profile"
                        onError={handleImageError}
                      />
                    </button>

                    {/* Dropdown Menu */}
                    <div
                      className={`absolute right-0 mt-2 w-48 rounded-lg shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 transform transition-all duration-200 ease-out
                        ${isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"}`}
                    >
                      <button
                        onClick={handleSignOut}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors duration-200"
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <button
                  onClick={() => signIn("google")}
                  className="flex items-center space-x-2 bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-full font-medium transition-colors duration-200 shadow-md hover:shadow-lg"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>Login</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
