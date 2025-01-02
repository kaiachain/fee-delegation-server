import React from "react";

export default function DelDappBtn({ dappId, deleteDapp }: any) {
  const handleDeleteDapp = async () => {
    deleteDapp(dappId);
  };

  return (
    <button
      onClick={handleDeleteDapp}
      className="absolute bg-slate-500 px-2 py-1 h-10 w-10 rounded-full right-0 top-[43%] translate-x-16 text-white opacity-10 hover:opacity-40 text-lg font-extrabold"
    >
      x
    </button>
  );
}
