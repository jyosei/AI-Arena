import React, { useState, useEffect } from 'react';
import axios from 'axios';

const DatasetPreviewModal = ({ filename, onClose }) => {
  const [previewData, setPreviewData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!filename) return;

    const fetchPreviewData = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`/api/models/datasets/preview/${filename}/`);
        setPreviewData(response.data);
        setError('');
      } catch (err) {
        setError('无法加载数据集预览。请稍后再试。');
        console.error('Error fetching dataset preview:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPreviewData();
  }, [filename]);

  return (
    // 背景遮罩层
    <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center p-4">
      {/* 模态窗口主体 */}
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* 头部 */}
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">预览: {filename}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            {/* 关闭图标 (X) */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 内容区域 */}
        <div className="p-4 overflow-auto">
          {loading && <p className="text-center text-gray-300">加载中...</p>}
          {error && <p className="text-center text-red-400">{error}</p>}
          {previewData && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-700">
                  <tr>
                    {previewData.headers.map((header) => (
                      <th key={header} className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                  {previewData.rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="hover:bg-gray-700/50">
                      {previewData.headers.map((header) => (
                        <td key={`${rowIndex}-${header}`} className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 max-w-xs truncate" title={row[header]}>
                          {row[header]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DatasetPreviewModal;