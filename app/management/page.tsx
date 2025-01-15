"use client";

import { useEffect, useState } from "react";
import { DappCard } from "../components/DappCard";
import DelDappBtn from "../components/DelDappBtn";
import fetchData from "@/lib/apiUtils";
import { useSession, signOut } from "next-auth/react";
import AddDappBtn from "../components/AddDappBtn";
import { Dapp } from "@/types";

export default function Management() {
  const [isLoading, setIsLoading] = useState(true);
  const [dapps, setDapps] = useState<any[]>([]);
  const { data: session } = useSession();
  const [filter, setFilter] = useState("");

  if (session?.sessionExpired) {
    signOut();
    return;
  }

  const getDapps = async () => {
    const dapps = await fetch("/api/dapps", { method: "GET" }).then((res) =>
      res.json()
    );
    return dapps;
  };

  const deleteDapp = async (dappId: string) => {
    if (confirm("Are you sure you want to delete this dapp?")) {
      const result = await fetchData(
        "/dapps/",
        { method: "DELETE", body: { id: dappId } },
        session
      );
      if (!result.status) {
        return;
      }
      setDapps(dapps.filter((dapp) => dapp.id !== dappId));
    }
  };

  const onDappAdd = (dapp: Dapp) => {
    setDapps([...dapps, dapp]);
  };

  useEffect(() => {
    if (session?.sessionExpired) {
      signOut();
      return;
    }
    if (session?.user.role !== "editor") {
      return;
    }
    getDapps().then((dapps) => {
      setDapps(dapps);
      setIsLoading(false);
    });
  }, [session]);

  if (isLoading && session)
    return (
      <div className="text-2xl font-bold text-center mt-24">Loading...</div>
    );
  else
    return (
      <div className="flex flex-col items-center w-screen mt-24">
        {session?.user.role !== "editor" ? (
          <div className="text-2xl font-bold text-red-500">
            You are not authorized.
          </div>
        ) : (
          <>
            <div className="mb-4 w-1/3">
              <input
                type="text"
                placeholder="Filter by name | URL | Contract Address"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="border border-gray-300 p-2 w-full rounded"
              />
            </div>
            {dapps
              .filter(
                (dapp) =>
                  dapp.name.toLowerCase().includes(filter.toLowerCase()) ||
                  dapp.url.toLowerCase().includes(filter.toLowerCase()) ||
                  dapp.contracts.some((contract: any) =>
                    contract.address
                      .toLowerCase()
                      .includes(filter.toLowerCase())
                  )
              )
              .map((dapp) => (
                <DappCard key={dapp.id} dapp={dapp}>
                  <DelDappBtn
                    dapp={dapp}
                    deleteDapp={() => deleteDapp(dapp.id)}
                  />
                </DappCard>
              ))}
            <AddDappBtn onDappAdd={onDappAdd} />
          </>
        )}
      </div>
    );
}
