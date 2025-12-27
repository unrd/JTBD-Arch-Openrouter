
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { generateJTBDGraph } from './services/geminiService';
import { AppState, JTBDNode, JobLevel, JOB_EXAMPLES, AnalysisMode } from './types';
import { TreeDiagram } from './components/TreeDiagram';

const LOCAL_STORAGE_KEY = 'jtbd_graph_v1';
const API_KEY_STORAGE_KEY = 'openrouter_api_key';

// --- Simulated shadcn/ui components ---
const Button = ({ variant = 'default', className = '', ...props }: any) => {
  const base = "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-9 px-4 py-2";
  const variants = {
    default: "bg-slate-900 text-slate-50 hover:bg-slate-900/90 shadow-sm",
    outline: "border border-slate-200 bg-white hover:bg-slate-100 hover:text-slate-900 text-slate-700 shadow-sm",
    ghost: "hover:bg-slate-100 hover:text-slate-900 text-slate-600",
    destructive: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200",
    secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200"
  };
  return <button className={`${base} ${variants[variant as keyof typeof variants]} ${className}`} {...props} />;
};

const Input = ({ className = '', ...props }: any) => (
  <input className={`flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 disabled:cursor-not-allowed disabled:opacity-50 ${className}`} {...props} />
);

const Textarea = ({ className = '', ...props }: any) => (
  <textarea className={`flex min-h-[60px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 disabled:cursor-not-allowed disabled:opacity-50 ${className}`} {...props} />
);

const Label = ({ children, className = '' }: any) => (
  <label className={`text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-500 uppercase tracking-wider ${className}`}>{children}</label>
);

const Card = ({ children, className = '' }: any) => (
  <div className={`rounded-lg border border-slate-200 bg-white text-slate-950 shadow-sm ${className}`}>{children}</div>
);

// Tab Component (Simulated)
const TabsList = ({ children, className = '' }: any) => (
  <div className={`inline-flex h-9 items-center justify-center rounded-lg bg-slate-100 p-1 text-slate-500 ${className}`}>{children}</div>
);

const TabsTrigger = ({ isActive, onClick, children }: any) => (
  <button 
    onClick={onClick}
    className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${isActive ? 'bg-white text-slate-950 shadow' : 'hover:bg-slate-200/50 hover:text-slate-900'}`}
  >
    {children}
  </button>
);

const ApiKeyModal = ({ isOpen, onSave, onClose, initialKey = '' }: { isOpen: boolean; onSave: (key: string) => void; onClose: () => void; initialKey?: string }) => {
  const [key, setKey] = useState(initialKey);

  useEffect(() => {
    setKey(initialKey);
  }, [initialKey, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 space-y-4 shadow-xl">
        <div className="flex justify-between items-start">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-slate-900">Настройка доступа</h2>
              <p className="text-sm text-slate-500">
                Введите API ключ OpenRouter для работы AI.
              </p>
            </div>
            {initialKey && (
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold px-2">
                    ✕
                </button>
            )}
        </div>
        
        <div className="space-y-2">
          <Label>OpenRouter API Key</Label>
          <Input 
            type="password" 
            placeholder="sk-or-..." 
            value={key} 
            onChange={(e: any) => setKey(e.target.value)}
            className="font-mono"
            autoFocus
          />
        </div>
        <div className="flex justify-end pt-2 gap-2">
           {initialKey && (
             <Button variant="outline" onClick={onClose} className="w-1/3">
               Отмена
             </Button>
           )}
           <Button onClick={() => onSave(key)} disabled={!key.trim()} className={initialKey ? "w-2/3" : "w-full"}>
             {initialKey ? 'Сохранить изменения' : 'Подтвердить и войти'}
           </Button>
        </div>
        <div className="text-center text-xs text-slate-400 mt-2">
           <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">
             Получить ключ на openrouter.ai
           </a>
        </div>
      </Card>
    </div>
  );
};

const App: React.FC = () => {
  // Analysis Inputs
  const [mode, setMode] = useState<AnalysisMode>('simple');
  const [problem, setProblem] = useState('');
  // Detailed Inputs
  const [persona, setPersona] = useState('');
  const [uniqueTrait, setUniqueTrait] = useState('');
  const [segmentContext, setSegmentContext] = useState('');

  const [state, setState] = useState<AppState>({
    isLoading: false,
    error: null,
    graph: null,
    selectedNodeId: null
  });
  
  const [hasSavedData, setHasSavedData] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // API Key State
  const [apiKey, setApiKey] = useState('');
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);

  // UI State
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  // Load saved data and API key on mount
  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      setHasSavedData(true);
    }
    
    const storedKey = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (storedKey) {
      setApiKey(storedKey);
    } else {
      // If no key found, open modal immediately
      setIsApiKeyModalOpen(true);
    }
  }, []);

  const handleSaveApiKey = (key: string) => {
    if (!key.trim()) return;
    localStorage.setItem(API_KEY_STORAGE_KEY, key);
    setApiKey(key);
    setIsApiKeyModalOpen(false);
  };

  const handleChangeApiKey = () => {
    setIsApiKeyModalOpen(true);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!problem.trim()) return;
    
    if (!apiKey) {
      setIsApiKeyModalOpen(true);
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null, selectedNodeId: null }));
    try {
      const graph = await generateJTBDGraph({
        mode,
        problem,
        persona: mode === 'detailed' ? persona : undefined,
        uniqueTrait: mode === 'detailed' ? uniqueTrait : undefined,
        segmentContext: mode === 'detailed' ? segmentContext : undefined
      }, apiKey);
      setState(prev => ({ ...prev, isLoading: false, error: null, graph }));
      // Auto-collapse panel on successful generation to show the graph
      setIsPanelOpen(false);
    } catch (err) {
      setState(prev => ({ 
        ...prev,
        isLoading: false, 
        error: err instanceof Error ? err.message : 'Произошла непредвиденная ошибка.', 
        graph: null 
      }));
    }
  };

  const handleSave = () => {
    if (state.graph) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state.graph));
      setHasSavedData(true);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  const handleLoad = () => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      try {
        const graph = JSON.parse(saved);
        setState(prev => ({ ...prev, graph, selectedNodeId: null, error: null }));
        setIsPanelOpen(false); // Collapse to show the loaded graph
      } catch (e) {
        setState(prev => ({ ...prev, error: 'Ошибка загрузки сохраненных данных.' }));
      }
    }
  };

  const handleExport = () => {
    if (!state.graph) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.graph, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `jtbd_graph_${Date.now()}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImportTrigger = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const graph = JSON.parse(content);
        if (!graph.id || !graph.type || !graph.name) {
          throw new Error("Неверный формат файла");
        }
        setState(prev => ({ ...prev, graph, selectedNodeId: null, error: null }));
        setIsPanelOpen(false);
      } catch (err) {
        setState(prev => ({ ...prev, error: 'Ошибка при чтении файла. Убедитесь, что это корректный JSON JTBD.' }));
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  // --- Graph Manipulation Logic ---
  const findNodeById = (root: JTBDNode, id: string): JTBDNode | null => {
    if (root.id === id) return root;
    if (root.children) {
      for (const child of root.children) {
        const found = findNodeById(child, id);
        if (found) return found;
      }
    }
    return null;
  };

  const updateNodeInTree = (root: JTBDNode, id: string, updates: Partial<JTBDNode>): JTBDNode => {
    if (root.id === id) {
      return { ...root, ...updates };
    }
    if (root.children) {
      return {
        ...root,
        children: root.children.map(child => updateNodeInTree(child, id, updates))
      };
    }
    return root;
  };

  const addChildToNode = (root: JTBDNode, parentId: string): JTBDNode => {
    if (root.id === parentId) {
      const currentLevel = root.type;
      const nextLevelMap: Record<JobLevel, JobLevel> = {
        [JobLevel.SUPER_BIG]: JobLevel.BIG,
        [JobLevel.BIG]: JobLevel.SMALL,
        [JobLevel.SMALL]: JobLevel.CORE,
        [JobLevel.CORE]: JobLevel.MICRO,
        [JobLevel.MICRO]: JobLevel.MICRO,
      };
      const newNode: JTBDNode = {
        id: `node_${Date.now()}`,
        name: 'Новая работа',
        type: nextLevelMap[currentLevel],
        description: '',
        annotation: '',
        children: []
      };
      return { ...root, children: [...(root.children || []), newNode] };
    }
    if (root.children) {
      return {
        ...root,
        children: root.children.map(child => addChildToNode(child, parentId))
      };
    }
    return root;
  };

  const deleteNodeFromTree = (root: JTBDNode, id: string): JTBDNode | null => {
    if (root.id === id) return null;
    if (root.children) {
      const newChildren = root.children
        .map(child => deleteNodeFromTree(child, id))
        .filter((child): child is JTBDNode => child !== null);
      return { ...root, children: newChildren };
    }
    return root;
  };

  const selectedNode = useMemo(() => {
    if (!state.graph || !state.selectedNodeId) return null;
    return findNodeById(state.graph, state.selectedNodeId);
  }, [state.graph, state.selectedNodeId]);

  const handleUpdateNode = (updates: Partial<JTBDNode>) => {
    if (!state.graph || !state.selectedNodeId) return;
    const newGraph = updateNodeInTree(state.graph, state.selectedNodeId, updates);
    setState(prev => ({ ...prev, graph: newGraph }));
  };

  const handleAddChild = () => {
    if (!state.graph || !state.selectedNodeId) return;
    const newGraph = addChildToNode(state.graph, state.selectedNodeId);
    setState(prev => ({ ...prev, graph: newGraph }));
  };

  const handleDeleteNode = () => {
    if (!state.graph || !state.selectedNodeId) return;
    const newGraph = deleteNodeFromTree(state.graph, state.selectedNodeId);
    setState(prev => ({ ...prev, graph: newGraph, selectedNodeId: null }));
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col h-screen overflow-hidden font-sans text-slate-950">
      
      <ApiKeyModal 
        isOpen={isApiKeyModalOpen} 
        onSave={handleSaveApiKey} 
        initialKey={apiKey}
        onClose={() => setIsApiKeyModalOpen(false)}
      />

      {/* --- Modern Header --- */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 flex-none">
        <div className="max-w-[1920px] mx-auto px-4 lg:px-6 h-16 flex items-center justify-between gap-4">
          
          {/* Brand Area */}
          <div className="flex items-center gap-3">
             <div className="bg-slate-950 w-9 h-9 rounded-lg flex items-center justify-center shadow-md">
               <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
               </svg>
             </div>
             <div className="leading-none flex items-baseline gap-2">
               <h1 className="text-sm font-bold text-slate-900 tracking-tight">JTBD Architect</h1>
               <span className="text-[10px] font-medium text-slate-500 uppercase tracking-widest hidden sm:inline-block">v2.1 OpenRouter</span>
             </div>
             
             {/* Collapsed State Badge */}
             {!isPanelOpen && problem && (
               <div className="hidden md:flex items-center ml-4 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 animate-in fade-in slide-in-from-left-2">
                 <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                 <span className="text-xs font-medium text-slate-700 max-w-[200px] truncate">{problem}</span>
               </div>
             )}
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2">
            <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleImportFile} />
            
            <div className="flex items-center bg-slate-100 rounded-md p-1 gap-1 mr-2">
               <Button variant="ghost" onClick={handleSave} disabled={!state.graph} className={`h-7 px-3 text-xs gap-2 ${saveStatus === 'saved' ? 'text-green-600 bg-green-50' : ''}`} title="Сохранить в браузер">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                  <span className="hidden lg:inline">Сохранить</span>
               </Button>
               <Button variant="ghost" onClick={handleLoad} disabled={!hasSavedData} className="h-7 px-3 text-xs gap-2" title="Загрузить">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  <span className="hidden lg:inline">Загрузить</span>
               </Button>
            </div>

            <Button variant="outline" onClick={handleImportTrigger} className="h-8 gap-2 px-3 text-xs border-dashed hidden sm:inline-flex">
               <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
               Импорт
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={!state.graph} className="h-8 gap-2 px-3 text-xs hidden sm:inline-flex">
               <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
               Экспорт
            </Button>
            
            {/* Divider and Toggle Button */}
            <div className="w-px h-5 bg-slate-200 mx-1"></div>
            <Button 
              variant="ghost" 
              onClick={() => setIsPanelOpen(!isPanelOpen)} 
              className={`h-8 px-3 text-xs font-medium transition-colors duration-200 ${!isPanelOpen ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600 hover:text-slate-900'}`} 
              title={isPanelOpen ? "Свернуть панель" : "Развернуть панель"}
            >
               {isPanelOpen ? 'Скрыть' : 'Показать'}
            </Button>

            <Button variant="ghost" onClick={handleChangeApiKey} className="h-8 px-3 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100" title="Настройки API">
              API
            </Button>
          </div>
        </div>
      </header>

      {/* --- Control Panel (Input Area) --- */}
      <div className={`bg-white shadow-sm z-20 flex-none relative transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden ${isPanelOpen ? 'max-h-[800px] border-b border-slate-200' : 'max-h-0 border-none'}`}>
         <div className="max-w-4xl mx-auto px-6 py-4">
           <form onSubmit={handleGenerate} className="space-y-4">
             {/* Mode Switcher */}
             <div className="flex justify-center mb-4">
               <TabsList>
                  <TabsTrigger isActive={mode === 'simple'} onClick={() => setMode('simple')}>Быстрый анализ</TabsTrigger>
                  <TabsTrigger isActive={mode === 'detailed'} onClick={() => setMode('detailed')}>Детальный анализ</TabsTrigger>
               </TabsList>
             </div>

             {/* Simple Input */}
             <div className="flex gap-2 relative">
                <Input
                  type="text"
                  value={problem}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProblem(e.target.value)}
                  placeholder="Какую проблему или работу вы хотите проанализировать? (например: 'Выучить иностранный язык')"
                  className="h-10 text-base"
                  disabled={state.isLoading}
                />
                {mode === 'simple' && (
                  <Button type="submit" disabled={state.isLoading || !problem.trim()} className="h-10 px-6 font-semibold">
                    {state.isLoading ? 'Думаю...' : 'Запуск'}
                  </Button>
                )}
             </div>

             {/* Detailed Inputs (Expandable) */}
             {mode === 'detailed' && (
               <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 mt-4 p-4 bg-slate-50 border border-slate-100 rounded-lg max-h-[30vh] overflow-y-auto">
                    <div className="space-y-1.5">
                      <Label>Портрет клиента</Label>
                      <Textarea 
                        placeholder="Напр: IT-менеджер, 35 лет..." 
                        value={persona}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPersona(e.target.value)}
                        className="bg-white h-24 resize-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Отличительная черта (УТП)</Label>
                      <Textarea 
                        placeholder="Напр: Ограниченный бюджет..." 
                        value={uniqueTrait}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setUniqueTrait(e.target.value)}
                        className="bg-white h-24 resize-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Контекст / Сегмент</Label>
                      <Textarea 
                        placeholder="Напр: Стартап в фазе роста..." 
                        value={segmentContext}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSegmentContext(e.target.value)}
                        className="bg-white h-24 resize-none"
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={state.isLoading || !problem.trim()} className="w-full h-10 font-semibold text-base shadow-sm">
                    {state.isLoading ? 'Глубокий анализ...' : 'Сгенерировать детальный граф'}
                  </Button>
               </div>
             )}
           </form>
         </div>
      </div>

      {/* --- Main Workspace --- */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar */}
        <aside className="w-64 bg-slate-50 border-r border-slate-200 p-6 overflow-y-auto hidden lg:block z-10 flex-none">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-widest mb-6">Справочник уровней</h2>
          <div className="space-y-6">
            {(Object.entries(JOB_EXAMPLES) as [JobLevel, any][]).map(([level, info]) => (
              <div key={level} className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-sm bg-slate-800"></div>
                  <span className="text-[10px] font-bold text-slate-700 uppercase tracking-tight">{level}</span>
                </div>
                <div className="p-3 rounded-md border border-slate-200 bg-white shadow-sm">
                  <p className="text-[10px] text-slate-900 font-bold mb-1 uppercase tracking-tighter">{info.label}</p>
                  <p className="text-xs text-slate-500 italic leading-relaxed">"{info.example}"</p>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Tree Canvas Area */}
        <main className="flex-1 relative bg-slate-100/30 p-4 overflow-hidden w-full">
          {state.error ? (
            <div className="absolute inset-0 flex items-center justify-center p-8">
               <Card className="px-6 py-8 flex flex-col items-center gap-4 max-w-sm text-center border-red-200 bg-red-50/50">
                 <div className="rounded-full bg-red-100 p-3 text-red-600">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                 </div>
                 <div>
                    <span className="font-bold text-slate-900 block mb-1">Ошибка генерации</span>
                    <p className="text-sm text-slate-600">{state.error}</p>
                 </div>
                 <Button variant="outline" onClick={() => setState(prev => ({...prev, error: null}))} className="mt-2 border-red-200 hover:bg-red-100">Закрыть</Button>
               </Card>
            </div>
          ) : state.graph ? (
            <TreeDiagram 
              data={state.graph} 
              selectedNodeId={state.selectedNodeId} 
              onNodeClick={(id) => setState(prev => ({...prev, selectedNodeId: id}))}
            />
          ) : !state.isLoading && (
            <div className="h-full flex flex-col items-center justify-center text-center p-12">
               <div className="w-24 h-24 bg-white rounded-2xl border border-slate-200 flex items-center justify-center mb-8 shadow-sm">
                 <svg className="w-12 h-12 text-slate-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                 </svg>
               </div>
               <h2 className="text-2xl font-bold text-slate-900 mb-3 tracking-tight">Начните проектирование</h2>
               <p className="text-slate-500 max-w-md text-base leading-relaxed mb-8">
                 Выберите режим анализа выше и введите задачу клиента, чтобы построить профессиональную карту работ (Jobs To Be Done).
               </p>
               <div className="flex gap-3">
                  {hasSavedData && (
                    <Button variant="outline" onClick={handleLoad} className="gap-2 h-10 px-5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                      Восстановить сессию
                    </Button>
                  )}
                  <Button variant="outline" onClick={handleImportTrigger} className="gap-2 h-10 px-5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    Открыть файл
                  </Button>
               </div>
            </div>
          )}

          {state.isLoading && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
              <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin"></div>
              <p className="mt-6 text-sm font-bold text-slate-900 uppercase tracking-widest">
                {mode === 'detailed' ? 'Анализ контекста и персоны...' : 'Декомпозиция работ...'}
              </p>
            </div>
          )}
        </main>

        {/* Right Sidebar: Node Editor */}
        <aside className={`absolute top-0 right-0 h-full w-[400px] bg-white border-l border-slate-200 shadow-2xl z-20 transition-transform duration-300 ease-in-out ${state.selectedNodeId ? 'translate-x-0' : 'translate-x-full'}`}>
          {selectedNode ? (
            <div className="flex flex-col h-full">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Свойства Узла</h3>
                <Button variant="ghost" onClick={() => setState(prev => ({...prev, selectedNodeId: null}))} className="h-8 w-8 p-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Main Info Card */}
                <Card className="p-4 space-y-4 shadow-sm border-slate-200">
                   <div className="space-y-2">
                    <Label>Тип работы</Label>
                    <select 
                      value={selectedNode.type}
                      onChange={(e) => handleUpdateNode({ type: e.target.value as JobLevel })}
                      className="flex h-9 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {Object.values(JobLevel).map(level => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>Название</Label>
                    <Textarea 
                      value={selectedNode.name}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleUpdateNode({ name: e.target.value })}
                      className="min-h-[80px] font-medium text-base"
                    />
                  </div>
                </Card>

                {/* Rationale/Annotation Card */}
                <Card className="p-4 space-y-4 bg-slate-50/80 border-slate-200">
                   <div className="space-y-2">
                    <div className="flex items-center gap-2 justify-between">
                        <Label>Логика классификации</Label>
                        <span className="text-[9px] font-bold text-slate-400 border border-slate-200 rounded px-1.5 py-0.5 bg-white uppercase tracking-wider">AI Insight</span>
                    </div>
                    <Textarea 
                      value={selectedNode.annotation || ''}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleUpdateNode({ annotation: e.target.value })}
                      className="min-h-[80px] text-slate-600 bg-white text-sm"
                      placeholder="Объяснение классификации..."
                    />
                  </div>
                </Card>

                {/* Description Card */}
                <div className="space-y-2">
                    <Label>Детальное описание</Label>
                    <Textarea 
                      value={selectedNode.description || ''}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleUpdateNode({ description: e.target.value })}
                      className="min-h-[100px] text-slate-600 text-sm"
                      placeholder="Дополнительный контекст..."
                    />
                  </div>
              </div>

              <div className="p-6 border-t border-slate-200 bg-slate-50 flex flex-col gap-3">
                <Button 
                  variant="secondary"
                  onClick={handleAddChild}
                  className="w-full gap-2 shadow-sm bg-white border border-slate-200 hover:bg-slate-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Добавить дочерний элемент
                </Button>
                <Button 
                  variant="destructive"
                  onClick={handleDeleteNode}
                  className="w-full gap-2 shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  Удалить ветку
                </Button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-white">
              <div className="text-slate-200 mb-6">
                 <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 12H4" />
                 </svg>
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Выберите элемент графа</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default App;
