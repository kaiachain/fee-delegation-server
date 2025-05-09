import React, { useEffect, useState } from 'react';
import Modal from 'react-modal';
import { fetchData } from "@/lib/apiUtils";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface StatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  dappId: string;
  dappName: string;
}

interface StatsData {
  month: string;
  usage: number;
}

export default function StatsModal({ isOpen, onClose, dappId, dappName }: StatsModalProps) {
  const [stats, setStats] = useState<StatsData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchStats();
    }
  }, [isOpen, dappId]);

  const fetchStats = async () => {
    try {
      const result = await fetchData(`/dapps/stats?dappId=${dappId}`, { method: "GET" }, null);
      if (!result.status) {
        console.error("Failed to fetch stats:", result.message);
        return;
      }
      setStats(result.data.stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const chartData = {
    labels: stats.map(stat => stat.month),
    datasets: [
      {
        label: 'Usage (KAIA)',
        data: stats.map(stat => stat.usage),
        backgroundColor: 'rgba(99, 102, 241, 0.8)',
        borderColor: 'rgb(99, 102, 241)',
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: `${dappName} Usage Statistics`,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Usage (KAIA)'
        }
      },
      x: {
        title: {
          display: true,
          text: 'Month'
        }
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="DApp Statistics"
      className="fixed inset-0 flex items-center justify-center p-4 bg-black bg-opacity-50"
      overlayClassName="fixed inset-0 bg-black bg-opacity-50"
    >
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">Usage Statistics</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        ) : (
          <div className="h-96">
            <Bar data={chartData} options={chartOptions} />
          </div>
        )}
      </div>
    </Modal>
  );
} 