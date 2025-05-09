import React, { useState } from "react";
import AddDappModal from "./AddDappModal";
import { Dapp } from "@/types";

interface AddDappBtnProps {
  onDappAdd: (dapp: Dapp) => void;
}

export default function AddDappBtn({ onDappAdd }: AddDappBtnProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setIsModalOpen(true)}
        className="inline-flex items-center px-4 py-2 text-base font-medium rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 shadow-sm hover:shadow"
      >
        <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        Add New Dapp
      </button>
      <AddDappModal
        isModalOpen={isModalOpen}
        setIsModalOpen={setIsModalOpen}
        onDappAdd={onDappAdd}
      />
    </div>
  );
}
