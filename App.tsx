import React, { useState, useEffect } from 'react';
import { Upload, Music, AudioLines, Sun, Moon, Sparkles } from 'lucide-react';
import WaveformEditor from './components/WaveformEditor';

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  // Default to Light Mode (false)
  const [isDarkMode, setIsDarkMode] = useState(false);
  // Option to enable/disable transcription
  const [enableTranscription, setEnableTranscription] = useState(false);

  // Apply theme class to html element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleCloseEditor = () => {
    setFile(null);
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-300">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 transition-colors duration-300">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-lg shadow-sm">
            <AudioLines className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">AudioCutter Pro</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">专业音频剪辑工具</p>
          </div>
        </div>
        <button
          onClick={toggleTheme}
          className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
          title={isDarkMode ? "切换到亮色模式" : "切换到深色模式"}
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-6 overflow-hidden">
        {!file ? (
          <div className="h-full flex flex-col items-center justify-center p-8 animate-fade-in">
            <div className="max-w-xl w-full text-center space-y-8">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-12 flex flex-col items-center space-y-6 shadow-2xl transition-colors duration-300">
                  <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4 transition-colors duration-300">
                    <Music size={40} className="text-indigo-500 dark:text-indigo-400" />
                  </div>
                  
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white">导入音频文件</h2>
                  <p className="text-gray-600 dark:text-gray-400 max-w-sm mx-auto">
                    选择本地音频文件 (MP3, WAV, AAC) 开始编辑。
                    所有处理均在您的浏览器本地进行，安全高效。
                  </p>

                  <div className="w-full space-y-4 pt-4">
                    <label 
                      htmlFor="audio-upload"
                      className="cursor-pointer inline-flex items-center justify-center w-full px-8 py-4 text-base font-medium text-white bg-accent hover:bg-accent-hover rounded-xl shadow-lg transform transition hover:-translate-y-1 active:scale-95 duration-200"
                    >
                      <Upload className="mr-3" size={20} />
                      选择文件
                    </label>
                    <input 
                      id="audio-upload" 
                      type="file" 
                      accept="audio/*" 
                      className="hidden"
                      onChange={handleFileChange}
                    />

                    {/* AI Transcription Toggle */}
                    <div className="flex items-center justify-center space-x-2 pt-2">
                       <input 
                          type="checkbox" 
                          id="transcription-toggle"
                          checked={enableTranscription}
                          onChange={(e) => setEnableTranscription(e.target.checked)}
                          className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500 dark:focus:ring-indigo-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                       />
                       <label htmlFor="transcription-toggle" className="text-sm font-medium text-gray-600 dark:text-gray-300 flex items-center cursor-pointer select-none">
                          <Sparkles size={14} className="mr-1.5 text-indigo-500" />
                          同时生成 AI 智能字幕
                       </label>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-600 mt-4">
                    支持格式: MP3, WAV, OGG, FLAC
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <WaveformEditor 
            file={file} 
            onClose={handleCloseEditor} 
            isDarkMode={isDarkMode} 
            enableTranscription={enableTranscription}
          />
        )}
      </main>
    </div>
  );
};

export default App;