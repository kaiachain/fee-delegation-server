import React, { useState } from "react";
import AddDappModal from "./AddDappModal";
import { Dapp } from "@/types";

interface AddDappBtnProps {
  onDappAdd: (dapp: Dapp) => void;
}

export default function AddDappBtn({ onDappAdd }: AddDappBtnProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  return (
    <div className="mb-10">
      <button
        className="bg-slate-500 px-3.5 py-1 rounded-full text-lg text-white opacity-50 hover:opacity-90 mt-5"
        onClick={() => setIsModalOpen(true)}
      >
        +
      </button>
      <AddDappModal
        isModalOpen={isModalOpen}
        setIsModalOpen={setIsModalOpen}
        onDappAdd={onDappAdd}
      />
    </div>
  );
}
