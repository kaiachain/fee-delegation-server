import React, { useState } from "react";
import Modal from "react-modal";

export default function EditModal({
  title,
  isModalOpen,
  setIsModalOpen,
  submitData,
  placeholder,
  initialValue,
}: any) {
  const [data, setData] = useState(initialValue);

  const change = (e: any) => {
    setData(e.target.value);
  };

  return (
    <Modal
      isOpen={isModalOpen}
      onRequestClose={() => setIsModalOpen(false)}
      contentLabel="Add Contract"
      ariaHideApp={false}
      className="fixed inset-0 flex justify-center items-center bg-black bg-opacity-50 z-1"
    >
      <div className="bg-white p-6 rounded-lg w-1/3">
        <h2 className="text-xl font-bold mb-4">{title}</h2>
        <input
          type="text"
          value={data}
          onChange={(e) => change(e)}
          placeholder={placeholder}
          className="border border-gray-300 p-2 mb-4 w-full"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setIsModalOpen(false)}
            className="bg-gray-500 text-white px-4 py-2 rounded"
          >
            Cancel
          </button>
          <button
            onClick={() => submitData(data)}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            Add
          </button>
        </div>
      </div>
    </Modal>
  );
}
