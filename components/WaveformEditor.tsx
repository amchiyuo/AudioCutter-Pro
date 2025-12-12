import React, { useEffect, useRef, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin, { Region } from 'wavesurfer.js/dist/plugins/regions.js';
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.js';
import ZoomPlugin from 'wavesurfer.js/dist/plugins/zoom.js';
import { Play, Pause, ZoomIn, ZoomOut, Scissors, Download, Trash2, Volume2, Eye, EyeOff, Sparkles } from 'lucide-react';
import { formatTime, audioBufferToWav } from '../utils/audioUtils';
import { RegionData } from '../types';
import { GoogleGenAI, Type } from "@google/genai";

interface WaveformEditorProps {
  file: File;
  onClose: () => void;
  isDarkMode: boolean;
  enableTranscription: boolean;
}

interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

const WaveformEditor: React.FC<WaveformEditorProps> = ({ file, onClose, isDarkMode, enableTranscription }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const regionsPluginRef = useRef<RegionsPlugin | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [zoom, setZoom] = useState(20);
  const [userRegions, setUserRegions] = useState<RegionData[]>([]);
  const [activeRegionId, setActiveRegionId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  
  // Transcription state
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);
  const [showTranscriptOnWave, setShowTranscriptOnWave] = useState(true);

  // Define colors based on theme
  const getThemeColors = (dark: boolean) => ({
    waveColor: dark ? '#4f46e5' : '#4338ca', // Indigo 600 vs Indigo 700
    progressColor: dark ? '#a5b4fc' : '#818cf8', // Indigo 300 vs Indigo 400
    timelineColor: dark ? '#9ca3af' : '#4b5563', // Gray 400 vs Gray 600
  });

  // Update WaveSurfer options when theme changes
  useEffect(() => {
    if (wavesurferRef.current) {
      const colors = getThemeColors(isDarkMode);
      wavesurferRef.current.setOptions({
        waveColor: colors.waveColor,
        progressColor: colors.progressColor,
      });
      
      // Regions color update if needed (optional, keeping semi-transparent indigo is safe for both)
    }
  }, [isDarkMode]);

  // Initialize WaveSurfer
  useEffect(() => {
    if (!containerRef.current || !timelineRef.current) return;

    const colors = getThemeColors(isDarkMode);

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: colors.waveColor,
      progressColor: colors.progressColor,
      cursorColor: '#f43f5e',
      barWidth: 2,
      barGap: 3,
      barRadius: 3,
      height: 160,
      minPxPerSec: 20,
      normalize: true,
      autoScroll: true,
      dragToSeek: true, // Allow dragging cursor
      plugins: [
        TimelinePlugin.create({ 
          container: timelineRef.current,
        }),
        ZoomPlugin.create(),
      ],
    });

    // Initialize Regions Plugin
    const wsRegions = RegionsPlugin.create();
    
    // Enable drag selection explicitly
    if (wsRegions.enableDragSelection) {
      wsRegions.enableDragSelection({
        color: 'rgba(99, 102, 241, 0.3)', // Default user region color
      });
    }

    ws.registerPlugin(wsRegions);
    regionsPluginRef.current = wsRegions;

    // Load file
    const fileUrl = URL.createObjectURL(file);
    ws.load(fileUrl);

    ws.on('ready', () => {
      setIsReady(true);
      setDuration(ws.getDuration());
      // Only transcribe if enabled prop is true
      if (enableTranscription) {
        handleTranscribe();
      }
    });

    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    ws.on('timeupdate', (currentTime) => setCurrentTime(currentTime));
    
    // Interaction Tweaks
    ws.on('click', () => {
      ws.pause();
      setActiveRegionId(null);
    });
    
    // Region events
    wsRegions.on('region-created', (region) => {
      if (region.id.startsWith('transcript-')) return;
      setActiveRegionId(region.id);
      updateUserRegionsList(wsRegions.getRegions());
    });

    wsRegions.on('region-updated', (region) => {
      if (region.id.startsWith('transcript-')) return;
      updateUserRegionsList(wsRegions.getRegions());
    });

    wsRegions.on('region-clicked', (region, e) => {
      e.stopPropagation();
      if (region.id.startsWith('transcript-')) return;
      setActiveRegionId(region.id);
      ws.pause(); 
    });

    wavesurferRef.current = ws;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        ws.playPause();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      ws.destroy();
      URL.revokeObjectURL(fileUrl);
    };
  }, [file]); // Re-init if file changes.

  const updateUserRegionsList = (wsRegions: Region[]) => {
    // Filter out transcript regions
    const formattedRegions = wsRegions
      .filter(r => !r.id.startsWith('transcript-'))
      .sort((a, b) => a.start - b.start)
      .map(r => ({
        id: r.id,
        start: r.start,
        end: r.end,
        color: r.color
      }));
    setUserRegions(formattedRegions);
  };

  const handlePlayPause = useCallback(() => {
    wavesurferRef.current?.playPause();
  }, []);

  const handleZoom = (delta: number) => {
    if (!wavesurferRef.current) return;
    const newZoom = Math.max(1, Math.min(1000, zoom + delta));
    setZoom(newZoom);
    wavesurferRef.current.zoom(newZoom);
  };

  const addRegion = () => {
    if (!regionsPluginRef.current || !wavesurferRef.current) return;
    const currentTime = wavesurferRef.current.getCurrentTime();
    
    // Add region starting at current time, length 5s
    regionsPluginRef.current.addRegion({
      start: currentTime,
      end: currentTime + 5, 
      content: `片段`,
      color: 'rgba(99, 102, 241, 0.3)',
      drag: true,
      resize: true,
    });
  };

  const removeRegion = (id: string) => {
    const region = regionsPluginRef.current?.getRegions().find(r => r.id === id);
    region?.remove();
    updateUserRegionsList(regionsPluginRef.current?.getRegions() || []);
  };

  const playRegion = (id: string) => {
    const region = regionsPluginRef.current?.getRegions().find(r => r.id === id);
    region?.play();
  };

  const exportRegion = async (id: string, index: number) => {
    const ws = wavesurferRef.current;
    const region = regionsPluginRef.current?.getRegions().find(r => r.id === id);
    if (!ws || !region) return;

    const buffer = ws.getDecodedData();
    if (!buffer) return;

    const sampleRate = buffer.sampleRate;
    const startFrame = Math.floor(region.start * sampleRate);
    const endFrame = Math.floor(region.end * sampleRate);
    const frameCount = endFrame - startFrame;

    if (frameCount <= 0) return;

    const newBuffer = new AudioContext().createBuffer(
      buffer.numberOfChannels,
      frameCount,
      sampleRate
    );

    for (let i = 0; i < buffer.numberOfChannels; i++) {
      const channelData = buffer.getChannelData(i);
      const newChannelData = newBuffer.getChannelData(i);
      for (let j = 0; j < frameCount; j++) {
        newChannelData[j] = channelData[startFrame + j];
      }
    }

    const wavBlob = audioBufferToWav(newBuffer);
    const url = URL.createObjectURL(wavBlob);
    
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    const originalName = file.name.replace(/\.[^/.]+$/, "");
    a.download = `${originalName}_part_${String(index + 1).padStart(2, '0')}.wav`;
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const handleTranscribe = async () => {
    if (!process.env.API_KEY || isTranscribing) {
      return;
    }
    
    setIsTranscribing(true);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const base64Data = await fileToBase64(file);
      
      const prompt = `请将音频文件转写为简体中文。请务必返回一个纯 JSON 数组。
      数组中的每个对象应包含以下字段：
      - "start": 开始时间（秒，浮点数）
      - "end": 结束时间（秒，浮点数）
      - "text": 转写的中文文本 (文本不需要太长，尽量按短句切分)
      
      请确保时间戳准确。`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: file.type || 'audio/mp3',
                data: base64Data
              }
            },
            { text: prompt }
          ]
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                start: { type: Type.NUMBER },
                end: { type: Type.NUMBER },
                text: { type: Type.STRING },
              },
              required: ['start', 'end', 'text'],
            },
          },
        }
      });
      
      const rawText = response.text || "";
      const jsonString = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      
      try {
        const parsed: TranscriptSegment[] = JSON.parse(jsonString);
        setTranscriptSegments(parsed);
        renderTranscriptRegions(parsed);
      } catch (parseError) {
        console.error("JSON parse error", parseError);
      }

    } catch (err: any) {
      console.error("Transcription failed", err);
    } finally {
      setIsTranscribing(false);
    }
  };

  const renderTranscriptRegions = (segments: TranscriptSegment[]) => {
    if (!regionsPluginRef.current) return;
    
    const regions = regionsPluginRef.current.getRegions();
    regions.forEach(r => {
      if (r.id.startsWith('transcript-')) {
        r.remove();
      }
    });

    if (!showTranscriptOnWave) return;

    segments.forEach((seg, idx) => {
      const contentEl = document.createElement('div');
      contentEl.textContent = seg.text;
      contentEl.style.fontSize = '12px';
      // Adjust transcript text color for better visibility in light mode
      contentEl.style.color = isDarkMode ? '#e0e7ff' : '#312e81'; 
      contentEl.style.whiteSpace = 'nowrap';
      contentEl.style.overflow = 'hidden';
      contentEl.style.textOverflow = 'ellipsis';
      contentEl.style.padding = '4px';
      contentEl.style.width = '100%';
      
      const r = regionsPluginRef.current!.addRegion({
        id: `transcript-${idx}`,
        start: seg.start,
        end: seg.end,
        color: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)', 
        drag: false,
        resize: false,
        content: contentEl,
      });

      if (r.element) {
        r.element.style.pointerEvents = 'none';
      }
    });
  };

  useEffect(() => {
    renderTranscriptRegions(transcriptSegments);
  }, [showTranscriptOnWave, isDarkMode]);


  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 shadow-2xl transition-colors duration-300">
      {/* Top Bar */}
      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-850 border-b border-gray-200 dark:border-gray-800 transition-colors duration-300">
        <div className="flex items-center space-x-4 overflow-hidden">
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors text-sm font-medium shrink-0"
          >
            &larr; 返回
          </button>
          <div className="h-6 w-px bg-gray-300 dark:bg-gray-700 mx-2 shrink-0"></div>
          <div className="overflow-hidden">
            <h2 className="text-gray-900 dark:text-white font-semibold truncate max-w-[500px] md:max-w-2xl lg:max-w-4xl" title={file.name}>{file.name}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
              {formatTime(currentTime)} / {formatTime(duration)}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 shrink-0 ml-4">
           {enableTranscription && (
             <div className={`flex items-center px-3 py-1.5 rounded bg-white dark:bg-gray-800 border transition-colors duration-300 ${isTranscribing ? 'border-indigo-500/50' : 'border-gray-200 dark:border-gray-700'}`}>
                {isTranscribing ? (
                  <>
                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse mr-2"></div>
                    <span className="text-xs text-gray-600 dark:text-gray-300">正在生成字幕...</span>
                  </>
                ) : transcriptSegments.length > 0 ? (
                  <>
                    <Sparkles size={12} className="text-indigo-500 dark:text-indigo-400 mr-2" />
                    <span className="text-xs text-gray-600 dark:text-gray-400">字幕已加载</span>
                  </>
                ) : (
                  <span className="text-xs text-gray-500">等待字幕</span>
                )}
             </div>
           )}

           {enableTranscription && transcriptSegments.length > 0 && (
             <button
               onClick={() => setShowTranscriptOnWave(!showTranscriptOnWave)}
               className={`p-2 rounded-md flex items-center gap-2 text-xs font-medium border transition-colors duration-300 ${
                 showTranscriptOnWave 
                   ? 'bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' 
                   : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700'
               }`}
               title="在波形图上显示字幕"
             >
               {showTranscriptOnWave ? <Eye size={16} /> : <EyeOff size={16} />}
             </button>
           )}
           
           <div className="h-6 w-px bg-gray-300 dark:bg-gray-700 mx-2"></div>
           <button 
            onClick={() => handleZoom(-10)} 
            className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white bg-white dark:bg-gray-800 border border-gray-200 dark:border-transparent rounded-md transition-colors"
            title="缩小"
          >
            <ZoomOut size={18} />
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-500 w-12 text-center">{zoom}px</span>
          <button 
            onClick={() => handleZoom(10)} 
            className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white bg-white dark:bg-gray-800 border border-gray-200 dark:border-transparent rounded-md transition-colors"
            title="放大"
          >
            <ZoomIn size={18} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative">
        {/* Waveform Area */}
        <div className="relative bg-gray-50 dark:bg-gray-950 p-6 min-h-[240px] flex flex-col justify-center border-b border-gray-200 dark:border-gray-800 transition-colors duration-300">
          {!isReady && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
            </div>
          )}
          <div ref={containerRef} className="w-full" />
          <div 
            ref={timelineRef} 
            className="w-full mt-2" 
            style={{ color: isDarkMode ? '#9ca3af' : '#4b5563' }}
          />
        </div>

        {/* Controls & Sidebar Split */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Playback Controls */}
          <div className="w-1/3 border-r border-gray-200 dark:border-gray-800 p-6 bg-white dark:bg-gray-900 flex flex-col items-center justify-center space-y-6 transition-colors duration-300">
            <div className="flex items-center space-x-6">
              <button
                onClick={handlePlayPause}
                disabled={!isReady}
                className="w-16 h-16 bg-accent hover:bg-accent-hover text-white rounded-full flex items-center justify-center shadow-lg transform transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                title="播放/暂停 (空格键)"
              >
                {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
              </button>
            </div>
            
            <div className="flex flex-col gap-2 w-full">
              <button
                onClick={addRegion}
                disabled={!isReady}
                className="flex items-center space-x-2 px-6 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-indigo-600 dark:text-indigo-400 border border-gray-200 dark:border-gray-700 rounded-lg transition-colors w-full justify-center disabled:opacity-50"
              >
                <Scissors size={20} />
                <span>标记剪辑区域</span>
              </button>
              <p className="text-xs text-gray-500 text-center px-4">
                点击上方按钮在当前指针位置标记，或在右侧波形图上直接<b>拖拽</b>创建选区。
              </p>
            </div>

            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-850 rounded-lg border border-gray-200 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400 space-y-2 w-full max-w-[240px] transition-colors duration-300">
              <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">操作指南:</p>
              <div className="flex justify-between">
                <span>点击波形:</span>
                <span className="text-gray-900 dark:text-gray-200">精确定位 (暂停)</span>
              </div>
              <div className="flex justify-between">
                <span>空格键:</span>
                <span className="text-gray-900 dark:text-gray-200">播放/暂停</span>
              </div>
              <div className="flex justify-between">
                <span>拖拽波形:</span>
                <span className="text-gray-900 dark:text-gray-200">快速圈选</span>
              </div>
            </div>
          </div>

          {/* Right: Clip List */}
          <div className="w-2/3 bg-white dark:bg-gray-900 flex flex-col transition-colors duration-300">
             <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-850 transition-colors duration-300">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-2">
                  <Volume2 size={16} />
                  剪辑列表
                </h3>
                <span className="bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs px-2 py-1 rounded-full">
                  {userRegions.length} 个片段
                </span>
             </div>
             
             <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {userRegions.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-600">
                    <Scissors size={48} className="mb-4 opacity-20" />
                    <p className="text-gray-500 dark:text-gray-500">暂无剪辑区域</p>
                    <p className="text-xs mt-2 text-center max-w-xs text-gray-400 dark:text-gray-500">
                       点击左侧“标记”按钮<br/>或在波形图上按住鼠标左键拖拽
                    </p>
                  </div>
                ) : (
                  userRegions.map((region, idx) => (
                    <div 
                      key={region.id}
                      className={`group flex items-center justify-between p-3 rounded-lg border transition-all ${
                        activeRegionId === region.id 
                          ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-500/50' 
                          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                      onClick={() => {
                        setActiveRegionId(region.id);
                        if (wavesurferRef.current) {
                           wavesurferRef.current.setTime(region.start);
                           wavesurferRef.current.pause();
                        }
                      }}
                    >
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-bold font-mono">
                          {idx + 1}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-200">
                             片段 {String(idx + 1).padStart(2, '0')}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-1">
                            {formatTime(region.start)} - {formatTime(region.end)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); playRegion(region.id); }}
                          className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                          title="预览播放"
                        >
                          <Play size={16} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); exportRegion(region.id, idx); }}
                          className="p-2 text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md"
                          title="导出 WAV"
                        >
                          <Download size={16} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeRegion(region.id); }}
                          className="p-2 text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md"
                          title="删除"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WaveformEditor;