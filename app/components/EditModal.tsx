import React, { useState } from "react";
import Modal from "react-modal";

interface EditModalProps {
  title: string;
  isModalOpen: boolean;
  setIsModalOpen: (isOpen: boolean) => void;
  submitData: (data: string, hasSwap?: boolean, swapAddress?: string) => void;
  placeholder: string;
  initialValue: string;
  isContract?: boolean;
  isDate?: boolean;
  allowReset?: boolean;
  resetValue?: string;
}

export default function EditModal({
  title,
  isModalOpen,
  setIsModalOpen,
  submitData,
  placeholder,
  initialValue,
  isContract = false,
  isDate = false,
  allowReset = false,
  resetValue = "",
}: EditModalProps) {
  const [data, setData] = useState(initialValue);
  const [hasSwap, setHasSwap] = useState(false);
  const [swapAddress, setSwapAddress] = useState("");

  const change = (e: React.ChangeEvent<HTMLInputElement>) => {
    setData(e.target.value);
  };

  const handleSubmit = () => {
    if (isContract) {
      submitData(data, hasSwap, swapAddress);
    } else {
      submitData(data);
    }
    setData(initialValue);
    setHasSwap(false);
    setSwapAddress("");
  };

  const handleReset = () => {
    setData(resetValue);
  };

  return (
    <Modal
      isOpen={isModalOpen}
      onRequestClose={() => {
        setIsModalOpen(false);
        setData(initialValue);
        setHasSwap(false);
        setSwapAddress("");
      }}
      contentLabel={title}
      ariaHideApp={false}
      className="fixed inset-0 flex justify-center items-center bg-black bg-opacity-50 z-50"
    >
      <div className="bg-white p-6 rounded-lg w-1/3 shadow-xl">
        <h2 className="text-xl font-bold mb-4 text-gray-900">{title}</h2>
        <div className="space-y-4">
          <div>
            <input
              type={isDate ? "date" : "text"}
              value={data}
              onChange={change}
              placeholder={placeholder}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500 transition-colors duration-200"
            />
          </div>
          
          {isContract && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="hasSwap"
                  checked={hasSwap}
                  onChange={(e) => setHasSwap(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="hasSwap" className="text-sm text-gray-700">Enable Swap</label>
              </div>
              
              {hasSwap && (
                <div className="pl-4 border-l-2 border-gray-200">
                  <input
                    type="text"
                    placeholder="Enter swap IN/OUT Token address"
                    value={swapAddress}
                    onChange={(e) => setSwapAddress(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500 transition-colors duration-200"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          {allowReset && (
            <button
              onClick={handleReset}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 shadow-sm hover:shadow"
            >
              Reset
            </button>
          )}
          <button
            onClick={() => {
              setIsModalOpen(false);
              setData(initialValue);
              setHasSwap(false);
              setSwapAddress("");
            }}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 shadow-sm hover:shadow"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-white bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-sm hover:shadow"
          >
            {isDate ? 'Update' : 'Add'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
