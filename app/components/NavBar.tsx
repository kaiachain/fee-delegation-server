"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { fetchData } from "@/lib/apiUtils";

export default function NavBar() {
  const [isVisible, setIsVisible] = useState(false);
  const [poolBalance, setPoolBalance] = useState(null);
  const { data: session, status } = useSession();

  const getPoolBalance = async () => {
    const result = await fetchData("/pool", { method: "GET" }, session);
    if (!result.status) {
      return;
    }
    setPoolBalance(result.data);
  };

  const toggleDropdown = () => {
    setIsVisible(!isVisible);
  };

  useEffect(() => {
    if (session?.sessionExpired) {
      signOut();
    }
    if (session) {
      getPoolBalance();
    }
  }, [session]);

  return (
    <nav className="bg-gray-800 absolute top-0 w-screen">
      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
        <div className="relative flex items-center justify-between h-16">
          <div className="flex flex-row items-center justify-center sm:items-stretch sm:justify-start">
            <div className="flex-shrink-0 flex items-center">
              <Link href="rank">
                <span className="text-white text-2xl font-extrabold">
                  Gas Fee Delegation | kaia
                </span>
              </Link>
            </div>
          </div>
          <div className="flex items-center justify-center sm:block sm:ml-6 w-[30%]">
            <div className="flex flex-row justify-evenly">
              <Link
                className="text-gray-300 hover:bg-gray-700 hover:text-white px-5 py-2 rounded-md text-sm font-medium"
                href="/rank"
              >
                Rank
              </Link>
              <Link
                className="text-gray-300 hover:bg-gray-700 hover:text-white px-5 py-2 rounded-md text-sm font-medium"
                href="/management"
              >
                Management
              </Link>
            </div>
          </div>
          {status === "authenticated" ? (
            <div className="absolute inset-y-0 right-0 flex items-center pr-2 sm:static sm:inset-auto sm:pr-0">
              <div className="flex items-center flex-row ml-3 relative gap-3">
                {poolBalance ? (
                  <span className="text-white text-sm font-bold mr-5">
                    Pool: {poolBalance} KAIA{" "}
                  </span>
                ) : (
                  <></>
                )}
                <span className="text-white text-sm font-bold">
                  {session?.user?.email}
                </span>
                <div>
                  <button
                    type="button"
                    className="bg-gray-800 flex text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white"
                    id="user-menu"
                    aria-expanded="false"
                    aria-haspopup="true"
                    onClick={toggleDropdown}
                  >
                    <img
                      className="h-8 w-8 rounded-full"
                      src={session?.user?.image as string}
                      alt=""
                    />
                  </button>
                </div>
                <div
                  className={`origin-top-right absolute right-0 mt-2 top-7 w-28
                    rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5
                    focus:outline-none ${isVisible ? "block" : "hidden"}`}
                  role="menu"
                  aria-orientation="vertical"
                  aria-labelledby="user-menu"
                >
                  <a
                    href="#"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    role="menuitem"
                  >
                    <button onClick={() => signOut()}>Sign out</button>
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => signIn("google")}
              className="hover:bg-gray-700 text-white px-4 py-2 rounded"
            >
              Login
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
