import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Theme context
const ThemeContext = createContext({
  darkMode: false,
  toggleDarkMode: () => {},
});

type Severity = "Low" | "Medium" | "High";
type SortOrder = "newest" | "oldest";

interface Incident {
  id: number;
  title: string;
  description: string;
  severity: Severity;
  reported_at: string;
}

const initialIncidents: Incident[] = [
  {
    id: 1,
    title: "Biased Recommendation Algorithm",
    description: "Algorithm consistently favored certain demographics...",
    severity: "Medium",
    reported_at: "2025-03-15T10:00:00Z",
  },
  {
    id: 2,
    title: "LLM Hallucination in Critical Info",
    description: "LLM provided incorrect safety procedure information...",
    severity: "High",
    reported_at: "2025-04-01T14:30:00Z",
  },
  {
    id: 3,
    title: "Minor Data Leak via Chatbot",
    description: "Chatbot inadvertently exposed non-sensitive user metadata...",
    severity: "Low",
    reported_at: "2025-03-20T09:15:00Z",
  },
];

// IndexedDB setup
const DB_NAME = "ai-incidents-db";
const STORE_NAME = "incidents";

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    
    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };
    
    request.onerror = (event) => {
      reject(`IndexedDB error: ${(event.target as IDBOpenDBRequest).error}`);
    };
  });
};

const loadIncidentsFromDB = async (): Promise<Incident[]> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      
      request.onsuccess = () => {
        if (request.result && request.result.length > 0) {
          resolve(request.result);
        } else {
          // Initialize with default data if empty
          saveIncidentsToDB(initialIncidents);
          resolve(initialIncidents);
        }
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    console.error("Failed to load incidents:", error);
    return initialIncidents;
  }
};

const saveIncidentsToDB = async (incidents: Incident[]): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    
    // Clear the store first
    store.clear();
    
    // Add all incidents
    for (const incident of incidents) {
      store.add(incident);
    }

    // Wait for transaction to complete
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error("Failed to save incidents:", error);
  }
};

export default function Dashboard() {
  // Theme state
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      return savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  // Save theme preference
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode(!darkMode);

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [filter, setFilter] = useState<Severity | "All">("All");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [expandedIds, setExpandedIds] = useState<number[]>([]);
  const [newIncident, setNewIncident] = useState({ title: "", description: "", severity: "Low" });
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredIncidents, setFilteredIncidents] = useState<Incident[]>(incidents);
  const [isCountExpanded, setIsCountExpanded] = useState(false);
  const [isCountRotating, setIsCountRotating] = useState(false);
  const [countAnimation, setCountAnimation] = useState(false);
  const floatingCounterRef = useRef<HTMLDivElement>(null);
  const [animateEntries, setAnimateEntries] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isCountExpanded && 
          floatingCounterRef.current && 
          !floatingCounterRef.current.contains(event.target as Node)) {
        toggleCountDisplay();
      }
    };
  
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isCountExpanded]);

  // Delete confirmation popup
  const [deletePopup, setDeletePopup] = useState({
    isOpen: false,
    incidentId: 0,
    title: ""
  });
  const deletePopupRef = useRef<HTMLDivElement>(null);

  // Load incidents from IndexedDB on initial render
  useEffect(() => {
    const fetchData = async () => {
      const data = await loadIncidentsFromDB();
      setIncidents(data);
      // Add slight delay before animating entries
      setTimeout(() => setAnimateEntries(true), 100);
    };
    fetchData();
  }, []);

  // Save incidents to IndexedDB whenever they change
  useEffect(() => {
    if (incidents.length > 0) {
      saveIncidentsToDB(incidents);
    }
  }, [incidents]);

  // Trigger count animation when incident count changes
  useEffect(() => {
    setCountAnimation(true);
    const timer = setTimeout(() => setCountAnimation(false), 1000);
    return () => clearTimeout(timer);
  }, [incidents.length]);

  // Handle click outside delete popup
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (deletePopupRef.current && !deletePopupRef.current.contains(event.target as Node)) {
        setDeletePopup(prev => ({ ...prev, isOpen: false }));
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const toggleCountDisplay = () => {
    setIsCountRotating(true);
    setTimeout(() => {
      setIsCountExpanded(!isCountExpanded);
      setIsCountRotating(false);
    }, 300);
  };

  const toggleDetails = (id: number) => {
    setExpandedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { title, description, severity } = newIncident;
    if (!title || !description) {
      toast.error("Please fill all fields");
      return;
    }
    const newEntry: Incident = {
      id: Date.now(), // Use timestamp as unique ID
      title,
      description,
      severity: severity as Severity,
      reported_at: new Date().toISOString(),
    };
    setIncidents(prev => [newEntry, ...prev]);
    setNewIncident({ title: "", description: "", severity: "Low" });
    toast.success(`New incident "${title}" added successfully!`);
  };

  const showDeleteConfirm = (id: number, title: string) => {
    setDeletePopup({
      isOpen: true,
      incidentId: id,
      title
    });
  };

  const confirmDelete = () => {
    const { incidentId, title } = deletePopup;
    setIncidents(prev => prev.filter(incident => incident.id !== incidentId));
    toast.info(`Incident "${title}" has been deleted`);
    setDeletePopup({ isOpen: false, incidentId: 0, title: "" });
  };

  useEffect(() => {
    const filtered = incidents
      .filter(i => filter === "All" || i.severity === filter)
      .filter(i => 
        i.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        i.description.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) =>
        sortOrder === "newest"
          ? new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime()
          : new Date(a.reported_at).getTime() - new Date(b.reported_at).getTime()
      );
    
    setFilteredIncidents(filtered);
  }, [incidents, filter, sortOrder, searchTerm]);

  const getSeverityColor = (severity: Severity, isDark = darkMode) => {
    if (isDark) {
      switch(severity) {
        case "Low": return "bg-emerald-900 text-emerald-200 border-emerald-700";
        case "Medium": return "bg-amber-900 text-amber-200 border-amber-700";
        case "High": return "bg-rose-900 text-rose-200 border-rose-700";
        default: return "";
      }
    } else {
      switch(severity) {
        case "Low": return "bg-emerald-100 text-emerald-800 border-emerald-300";
        case "Medium": return "bg-amber-100 text-amber-800 border-amber-300";
        case "High": return "bg-rose-100 text-rose-800 border-rose-300";
        default: return "";
      }
    }
  };

  // Count stats for the floating counter
  const lowCount = incidents.filter(i => i.severity === "Low").length;
  const mediumCount = incidents.filter(i => i.severity === "Medium").length;
  const highCount = incidents.filter(i => i.severity === "High").length;
  const totalCount = incidents.length;

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode }}>
      <div className={`min-h-screen transition-colors duration-300 ${darkMode 
        ? 'bg-gradient-to-br from-gray-900 to-slate-800 text-gray-100' 
        : 'bg-gradient-to-br from-indigo-50 to-sky-50 text-gray-800'}`}>
        <ToastContainer 
          position="bottom-left" 
          autoClose={1000} 
          theme={darkMode ? "dark" : "light"} 
        />
        
        {/* Navbar */}
        <div className={`${darkMode 
          ? 'bg-gray-800 shadow-md border-b border-gray-700' 
          : 'bg-white shadow-md border-b border-indigo-100'} sticky top-0 z-30`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <h1 className={`text-2xl font-bold ${darkMode ? 'text-gray-100' : 'text-indigo-900'}`}>
              <span className={darkMode ? 'text-purple-400' : 'text-indigo-600'}>AI</span> Safety Incident Dashboard
            </h1>
            <button 
              onClick={toggleDarkMode}
              className={`p-2 rounded-lg transition-colors duration-200 ${darkMode 
                ? 'bg-gray-700 hover:bg-gray-600 text-yellow-300' 
                : 'bg-indigo-100 hover:bg-indigo-200 text-indigo-800'}`}
              aria-label="Toggle dark mode"
            >
              {darkMode ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </div>
        </div>
        
        {/* Custom Delete Confirmation Popup */}
        {deletePopup.isOpen && (
          <div className="fixed inset-0 bg-black/30 dark:bg-gray-800/50 z-50 flex items-center justify-center backdrop-blur-sm">
            <div 
              ref={deletePopupRef}
              className={`relative ${darkMode 
                ? 'bg-gray-800 border-rose-800' 
                : 'bg-white border-rose-100'} rounded-xl p-6 max-w-md w-full transform transition-all duration-300 shadow-2xl border`}
              style={{ animation: "popup-appear 0.3s ease-out" }}
            >
              <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 bg-gradient-to-br from-rose-500 to-red-600 w-24 h-24 rounded-full flex items-center justify-center shadow-lg">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
              </div>
              
              <h3 className={`text-xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'} mt-8 mb-2 text-center`}>Delete Incident</h3>
              <p className={`${darkMode ? 'text-gray-300' : 'text-gray-600'} mb-6 text-center`}>
                Are you sure you want to delete "<span className="text-rose-500 font-semibold">{deletePopup.title}</span>"?
                <br />
                <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>This action cannot be undone.</span>
              </p>
              
              <div className="flex gap-4">
                <button 
                  onClick={() => setDeletePopup(prev => ({ ...prev, isOpen: false }))}
                  className={`flex-1 py-2 rounded-lg transition-colors duration-200 shadow-sm ${darkMode 
                    ? 'border border-gray-600 text-gray-300 hover:bg-gray-700' 
                    : 'border border-gray-300 text-gray-700 hover:bg-gray-100'}`}
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 py-2 rounded-lg bg-gradient-to-r from-rose-500 to-red-600 text-white font-medium hover:from-rose-600 hover:to-red-700 transition-colors duration-200 shadow-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Floating Animated Counter Circle */}
        <div 
          ref={floatingCounterRef}
          className="fixed bottom-8 right-8 z-40 transition-all duration-500 ease-in-out"
        >
          <div 
            className={`relative ${darkMode 
              ? 'bg-gray-800 border-purple-500 hover:border-purple-400' 
              : 'bg-white border-indigo-300 hover:border-indigo-400'} rounded-full shadow-xl cursor-pointer
              transform transition-all duration-300 hover:shadow-2xl
              border-4 
              ${isCountExpanded ? 'w-64 h-64' : 'w-16 h-16'}
              ${isCountRotating ? 'rotate-180' : 'rotate-0'}
              ${!isCountExpanded ? 'animate-bounce' : ''}
              flex items-center justify-center
            `}
            onClick={toggleCountDisplay}
          >
            {/* Compact view when collapsed */}
            {!isCountExpanded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-2xl font-bold ${darkMode ? 'text-purple-400' : 'text-indigo-600'} ${countAnimation ? 'animate-bounce' : ''}`}>
                  {totalCount}
                </span>
                
                {/* Animated pulse rings */}
                <div className={`absolute inset-0 border-2 rounded-full ${darkMode ? 'border-purple-500' : 'border-indigo-300'} ${countAnimation ? 'animate-ping' : 'opacity-0'}`}></div>
              </div>
            )}
            
            {/* Expanded view */}
            {isCountExpanded && (
              <div className="absolute inset-0 p-4 flex flex-col items-center justify-center">
                <div className="text-center mb-2">
                  <span className={`text-lg font-semibold ${darkMode ? 'text-gray-200' : 'text-indigo-900'}`}>Incident Count</span>
                  <div className={`text-3xl font-bold ${darkMode ? 'text-purple-400' : 'text-indigo-600'} mb-3`}>{totalCount}</div>
                </div>
                
                <div className="grid grid-cols-3 gap-2 w-full">
                  <div className={`${darkMode ? 'bg-emerald-900/50 border-emerald-700' : 'bg-emerald-50 border-emerald-100'} rounded-full p-2 flex flex-col items-center shadow-sm border`}>
                    <span className={`text-xs font-medium ${darkMode ? 'text-emerald-300' : 'text-emerald-700'}`}>Low</span>
                    <span className={`text-lg font-bold ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>{lowCount}</span>
                  </div>
                  
                  <div className={`${darkMode ? 'bg-amber-900/50 border-amber-700' : 'bg-amber-50 border-amber-100'} rounded-full p-2 flex flex-col items-center shadow-sm border`}>
                    <span className={`text-xs font-medium ${darkMode ? 'text-amber-300' : 'text-amber-700'}`}>Medium</span>
                    <span className={`text-lg font-bold ${darkMode ? 'text-amber-400' : 'text-amber-600'}`}>{mediumCount}</span>
                  </div>
                  
                  <div className={`${darkMode ? 'bg-rose-900/50 border-rose-700' : 'bg-rose-50 border-rose-100'} rounded-full p-2 flex flex-col items-center shadow-sm border`}>
                    <span className={`text-xs font-medium ${darkMode ? 'text-rose-300' : 'text-rose-700'}`}>High</span>
                    <span className={`text-lg font-bold ${darkMode ? 'text-rose-400' : 'text-rose-600'}`}>{highCount}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Left column - Incidents list */}
            <div className="lg:w-2/3">
              {/* Search and filters */}
              <div className={`${darkMode 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-white border-indigo-100'} p-5 rounded-xl shadow-md mb-6 border transition-colors duration-300`}>
                <div className="mb-4">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search incidents..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className={`w-full p-3 pl-10 rounded-lg ${darkMode 
                        ? 'border-gray-600 bg-gray-700/50 text-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-purple-500' 
                        : 'border-indigo-200 bg-indigo-50/50 text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'} transition-colors duration-300`}
                    />
                    <svg className={`absolute left-3 top-3.5 h-5 w-5 ${darkMode ? 'text-gray-400' : 'text-indigo-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                    </svg>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-4">
                  <div>
                    <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>Filter by Severity</label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setFilter("All")}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm
                          ${filter === "All" 
                            ? (darkMode ? "bg-purple-600 text-white" : "bg-indigo-600 text-white")
                            : (darkMode 
                                ? "bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600" 
                                : "bg-white text-gray-700 border border-indigo-200 hover:bg-indigo-50")
                          }`}
                      >
                        All
                      </button>
                      <button
                        onClick={() => setFilter("Low")}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm
                          ${filter === "Low" 
                            ? "bg-emerald-600 text-white" 
                            : (darkMode 
                                ? "bg-emerald-900/50 text-emerald-300 border border-emerald-700 hover:bg-emerald-800"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100")
                          }`}
                      >
                        Low
                      </button>
                      <button
                        onClick={() => setFilter("Medium")}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm
                          ${filter === "Medium" 
                            ? "bg-amber-600 text-white" 
                            : (darkMode 
                                ? "bg-amber-900/50 text-amber-300 border border-amber-700 hover:bg-amber-800"
                                : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100")
                          }`}
                      >
                        Medium
                      </button>
                      <button
                        onClick={() => setFilter("High")}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm
                          ${filter === "High" 
                            ? "bg-rose-600 text-white" 
                            : (darkMode 
                                ? "bg-rose-900/50 text-rose-300 border border-rose-700 hover:bg-rose-800"
                                : "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100")
                          }`}
                      >
                        High
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>Sort by</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSortOrder("newest")}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm
                          ${sortOrder === "newest" 
                            ? (darkMode ? "bg-purple-600 text-white" : "bg-indigo-600 text-white")
                            : (darkMode 
                                ? "bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600" 
                                : "bg-white text-gray-700 border border-indigo-200 hover:bg-indigo-50")
                          }`}
                      >
                        Newest First
                      </button>
                      <button
                        onClick={() => setSortOrder("oldest")}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm
                          ${sortOrder === "oldest" 
                            ? (darkMode ? "bg-purple-600 text-white" : "bg-indigo-600 text-white")
                            : (darkMode 
                                ? "bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600" 
                                : "bg-white text-gray-700 border border-indigo-200 hover:bg-indigo-50")
                          }`}
                      >
                        Oldest First
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Incident List */}
              {filteredIncidents.length === 0 ? (
                <div className={`text-center p-8 ${darkMode 
                  ? 'bg-gray-800 border-gray-700' 
                  : 'bg-white border-indigo-100'} rounded-xl shadow-md border transition-colors duration-300`}>
                  <svg className={`mx-auto h-16 w-16 ${darkMode ? 'text-gray-600' : 'text-indigo-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <h3 className={`mt-4 text-xl font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>No incidents found</h3>
                  <p className={`mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Try adjusting your search or filter criteria.</p>
                </div>
              ) : (
                <div className={`${darkMode 
                  ? 'bg-gray-800 border-gray-700' 
                  : 'bg-white border-indigo-100'} rounded-xl shadow-md overflow-hidden border transition-colors duration-300`}>
                  <ul className={`divide-y ${darkMode ? 'divide-gray-700' : 'divide-indigo-100'}`}>
                    {filteredIncidents.map((incident, index) => (
                      <li 
                        key={incident.id} 
                        className={`${darkMode 
                          ? 'hover:bg-gray-700/50' 
                          : 'hover:bg-indigo-50/50'} transition-all duration-300 ${
                            animateEntries ? 'animate-fade-in' : 'opacity-0'
                          }`}
                        style={{ 
                          animationDelay: `${index * 50}ms`, 
                          animationFillMode: 'forwards' 
                        }}
                      >
                        <div className="p-5">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2">
                            <div className="flex-1">
                              <h2 className={`text-lg font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>{incident.title}</h2>
                              <div className="flex gap-2 items-center mt-1">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getSeverityColor(incident.severity)}`}>
                                  {incident.severity}
                                </span>
                                <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{new Date(incident.reported_at).toLocaleString()}</span>
                              </div>
                            </div>
                            <div className="flex gap-2 mt-2 sm:mt-0">
                              <button 
                                className={`px-3 py-1 text-sm rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 shadow-sm ${
                                  darkMode 
                                    ? 'text-purple-400 border border-purple-700 hover:bg-purple-900/30 focus:ring-purple-500' 
                                    : 'text-indigo-600 border border-indigo-200 hover:bg-indigo-50 focus:ring-indigo-500'
                                } focus:ring-opacity-50`}
                                onClick={() => toggleDetails(incident.id)}
                              >
                                {expandedIds.includes(incident.id) ? "Hide Details" : "View Details"}
                              </button>
                              <button 
                                className={`px-3 py-1 text-sm rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 shadow-sm ${
                                  darkMode 
                                    ? 'text-rose-400 border border-rose-700 hover:bg-rose-900/30 focus:ring-rose-500' 
                                    : 'text-rose-600 border border-rose-200 hover:bg-rose-50 focus:ring-rose-500'
                                } focus:ring-opacity-50`} 
                                onClick={() => showDeleteConfirm(incident.id, incident.title)}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                          {expandedIds.includes(incident.id) && (
                            <div className={`mt-3 p-4 rounded-md shadow-sm ${
                              darkMode 
                                ? 'bg-gray-700/50 border-l-4 border-purple-500' 
                                : 'bg-indigo-50/50 border-l-4 border-indigo-500'
                            } ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              {incident.description}
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Right column - Report form */}
            <div className="lg:w-1/3">
              <div className={`${darkMode 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-white border-indigo-100'} rounded-xl shadow-md p-6 sticky top-24 border transition-colors duration-300`}>
                <h2 className={`text-xl font-bold mb-4 ${darkMode 
                  ? 'text-gray-100 border-b border-gray-700' 
                  : 'text-indigo-900 border-b border-indigo-100'} pb-2`}>Report New Incident</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-1`}>Incident Title</label>
                    <input
                      className={`w-full rounded-lg p-3 ${darkMode 
                        ? 'border-gray-600 bg-gray-700/50 text-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-purple-500' 
                        : 'border-indigo-200 bg-indigo-50/50 text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'} transition-colors duration-300`}
                      placeholder="Enter a descriptive title"
                      value={newIncident.title}
                      onChange={e => setNewIncident({ ...newIncident, title: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-1`}>Description</label>
                    <textarea
                      className={`w-full rounded-lg p-3 min-h-[150px] ${darkMode 
                        ? 'border-gray-600 bg-gray-700/50 text-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-purple-500' 
                        : 'border-indigo-200 bg-indigo-50/50 text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'} transition-colors duration-300`}
                      placeholder="Provide a detailed description of the incident"
                      value={newIncident.description}
                      onChange={e => setNewIncident({ ...newIncident, description: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-1`}>Severity Level</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewIncident({ ...newIncident, severity: "Low" })}
                        className={`py-2 px-4 rounded-lg font-medium text-sm transition-colors 
                          ${newIncident.severity === "Low" 
                            ? "bg-emerald-600 text-white" 
                            : (darkMode 
                                ? "bg-emerald-900/50 text-emerald-300 border border-emerald-700 hover:bg-emerald-800"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100")
                          }`}
                      >
                        Low
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewIncident({ ...newIncident, severity: "Medium" })}
                        className={`py-2 px-4 rounded-lg font-medium text-sm transition-colors 
                          ${newIncident.severity === "Medium" 
                            ? "bg-amber-600 text-white" 
                            : (darkMode 
                                ? "bg-amber-900/50 text-amber-300 border border-amber-700 hover:bg-amber-800"
                                : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100")
                          }`}
                      >
                        Medium
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewIncident({ ...newIncident, severity: "High" })}
                        className={`py-2 px-4 rounded-lg font-medium text-sm transition-colors 
                          ${newIncident.severity === "High" 
                            ? "bg-rose-600 text-white" 
                            : (darkMode 
                                ? "bg-rose-900/50 text-rose-300 border border-rose-700 hover:bg-rose-800"
                                : "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100")
                          }`}
                      >
                        High
                      </button>
                    </div>
                  </div>
                  <button 
                    type="submit" 
                    className={`w-full px-6 py-3 rounded-lg font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-opacity-50 shadow-md ${
                      darkMode 
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-700 text-white hover:from-purple-700 hover:to-indigo-800 focus:ring-purple-500' 
                        : 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white hover:from-indigo-700 hover:to-indigo-800 focus:ring-indigo-500'
                    }`}
                  >
                    Submit Incident Report
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>

        {/* Add CSS for custom animations */}
        <style jsx>{`
          @keyframes popup-appear {
            0% { transform: scale(0.8); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
          }
          
          @keyframes fade-in {
            0% { opacity: 0; transform: translateY(10px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          
          .animate-fade-in {
            animation: fade-in 0.5s ease-out;
          }
        `}</style>
      </div>
    </ThemeContext.Provider>
  );
}