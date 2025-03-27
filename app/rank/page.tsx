"use client";

import React, { useEffect, useState } from "react";

export default function Page() {
  const [dapps, setDapps] = useState<any[]>([]);

  const getDapps = async () => {
    const dapps = await fetch("/api/dapps", { method: "GET" }).then((res) =>
      res.json()
    );
    return dapps;
  };

  useEffect(() => {
    getDapps().then((dapps) => setDapps(dapps));
  }, []);

  return (
    <div className="flex flex-col w-full mt-10 p-10">
      <ul className="flex flex-col my-5 ml-10">
        <div className="flex flex-row items-center">
          <span className="w-[5%] flex flex-row justify-center items-center font-bold bg-slate-400 rounded-tr-2xl text-xl rounded-custom-t hover:bg-slate-500 py-1 px-[10px] dark: text-black">
            Num
          </span>
          <span className="w-[25%] flex flex-row justify-center items-center font-bold bg-slate-400 rounded-tr-2xl text-lg rounded-custom-t hover:bg-slate-500 py-1 px-[10px] dark: text-black">
            Team (Dapp Name)
          </span>
          <span className="w-[20%] flex flex-row justify-center items-center font-bold bg-slate-400 rounded-tr-2xl text-lg rounded-custom-t hover:bg-slate-500 py-1 px-[10px] dark: text-black">
            URL
          </span>
          <span className="w-[12%] flex flex-row justify-center items-center font-bold bg-slate-400 rounded-tr-2xl text-lg rounded-custom-t hover:bg-slate-500 py-1 px-[10px] dark: text-black">
            Total Used
          </span>
          <span className="w-[12%] flex flex-row justify-center items-center font-bold bg-slate-400 rounded-tr-2xl text-lg rounded-custom-t hover:bg-slate-500 py-1 px-[10px] dark: text-black">
            Balance
          </span>
          <span className="w-[18%] flex flex-row justify-center items-center font-bold bg-slate-400 rounded-tr-2xl text-lg rounded-custom-t hover:bg-slate-500 py-1 px-[10px] dark: text-black">
            Created At
          </span>
        </div>
        {dapps
          .sort((a, b) => b.totalUsed - a.totalUsed)
          .map((dapp, idx) => (
            <li key={idx}>
              <div className="flex flex-row hover:bg-black-overlay-04 hover:rounded-[10px] m-[1px]">
                <span className="w-[5%] flex flex-row items-center py-3 bg-slate-200 hover:bg-slate-400 justify-center dark: text-black">
                  {idx + 1}
                </span>
                <span className="w-[25%] flex flex-row items-center py-3 bg-slate-200 hover:bg-slate-400 justify-center dark: text-black">
                  {dapp.name}
                </span>
                <span className="w-[20%] flex flex-row items-center py-3 bg-slate-200 hover:bg-slate-400 justify-center dark: text-black">
                  {dapp.url}
                </span>
                <span className="w-[12%] flex flex-row items-center py-3 bg-slate-200 hover:bg-slate-400 justify-center dark: text-black">
                  {dapp.totalUsed}
                </span>
                <span className="w-[12%] flex flex-row items-center py-3 bg-slate-200 hover:bg-slate-400 justify-center dark: text-black">
                  {dapp.balance}
                </span>
                <span className="w-[18%] flex flex-row items-center py-3 bg-slate-200 hover:bg-slate-400 justify-center dark: text-black">
                  {dapp.createdAt}
                </span>
              </div>
            </li>
          ))}
      </ul>
    </div>
  );
}
