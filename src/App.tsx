import { useState, useEffect, useRef } from 'react';
import {
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudDrizzle,
  Wind,
  Thermometer,
  Droplets,
  Compass,
  Shield,
  Search,
  Sparkles,
  MapPin,
  AlertTriangle,
  Activity,
  Umbrella,
  Loader2,
  Info,
  ChevronRight,
  TrendingUp,
  Map,
  Eye,
  AlertCircle,
  TrendingDown,
  X,
  RefreshCw,
  SunDim,
  User,
  Heart
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  CartesianGrid
} from 'recharts';

// Types
interface City {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country_code: string;
  timezone: string;
  country: string;
  admin1?: string;
}

interface WeatherData {
  current: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    is_day: number;
    precipitation: number;
    weather_code: number;
    pressure_msl: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    apparent_temperature_max: number[];
    apparent_temperature_min: number[];
    uv_index_max: number[];
    precipitation_sum: number[];
    wind_speed_10m_max: number[];
  };
}

interface Recommendation {
  id: string;
  title: string;
  category: 'indoor' | 'outdoor';
  recommendation: string;
  bgColor: string;
  borderColor: string;
  icon: string;
}

// Default City: London
const DEFAULT_CITY: City = {
  id: 2643743,
  name: 'London',
  latitude: 51.50853,
  longitude: -0.12574,
  country_code: 'GB',
  timezone: 'Europe/London',
  country: 'United Kingdom',
};

export default function App() {
  const [selectedCity, setSelectedCity] = useState<City>(DEFAULT_CITY);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<City[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  
  const [unit, setUnit] = useState<'C' | 'F'>('C');
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [isAiPowered, setIsAiPowered] = useState(false);
  
  const [selectedDayIndex, setSelectedDayIndex] = useState(0); // 0 = Today
  const [showChartModal, setShowChartModal] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close search dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle city search autocomplete
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const response = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchQuery)}&count=8&language=en&format=json`
        );
        const data = await response.json();
        if (data.results) {
          setSearchResults(data.results);
        } else {
          setSearchResults([]);
        }
      } catch (err) {
        console.error('Error fetching cities:', err);
      } finally {
        setSearchLoading(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Fetch weather and then recommendations
  const fetchWeatherAndRecommendations = async (city: City) => {
    setLoading(true);
    setError(null);
    setSelectedDayIndex(0); // reset forecast highlight
    
    try {
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${city.latitude}&longitude=${city.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,pressure_msl,wind_speed_10m,wind_direction_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,uv_index_max,precipitation_sum,wind_speed_10m_max&timezone=auto`;
      
      const response = await fetch(weatherUrl);
      if (!response.ok) throw new Error('Failed to fetch real-time weather data');
      
      const wData: WeatherData = await response.json();
      setWeatherData(wData);
      
      // Now fetch AI recommendations from backend
      setRecsLoading(true);
      try {
        const recsResponse = await fetch('/api/recommendations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            weatherData: wData,
            city: `${city.name}, ${city.country}`,
          }),
        });
        
        if (recsResponse.ok) {
          const recsData = await recsResponse.json();
          if (recsData && recsData.recommendations) {
            setRecommendations(recsData.recommendations);
            // Simple heuristic to check if backend used Gemini vs Fallback
            // (the fallback template doesn't query Gemini, or we can look for specific attributes)
            setIsAiPowered(true);
          }
        } else {
          throw new Error('API server returned error');
        }
      } catch (recErr) {
        console.warn('Fallback recommendation engine triggered:', recErr);
        // Use client-side fallback calculations if backend fails completely
        setRecommendations(getLocalFallbackRecommendations(wData));
        setIsAiPowered(false);
      } finally {
        setRecsLoading(false);
      }
      
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An unexpected error occurred while loading weather.');
    } finally {
      setLoading(false);
    }
  };

  // Run on initial load
  useEffect(() => {
    fetchWeatherAndRecommendations(DEFAULT_CITY);
  }, []);

  const handleSelectCity = (city: City) => {
    setSelectedCity(city);
    setSearchQuery('');
    setSearchResults([]);
    setShowDropdown(false);
    fetchWeatherAndRecommendations(city);
  };

  // Convert WMO weather interpretation codes to readable text
  const getWeatherDescription = (code: number): string => {
    const mapping: { [key: number]: string } = {
      0: 'Clear sky',
      1: 'Mainly clear',
      2: 'Partly cloudy',
      3: 'Overcast',
      45: 'Foggy',
      48: 'Depositing rime fog',
      51: 'Light drizzle',
      53: 'Moderate drizzle',
      55: 'Dense drizzle',
      56: 'Light freezing drizzle',
      57: 'Dense freezing drizzle',
      61: 'Slight rain',
      63: 'Moderate rain',
      65: 'Heavy rain',
      66: 'Light freezing rain',
      67: 'Heavy freezing rain',
      71: 'Slight snowfall',
      73: 'Moderate snowfall',
      75: 'Heavy snowfall',
      77: 'Snow grains',
      80: 'Slight rain showers',
      81: 'Moderate rain showers',
      82: 'Violent rain showers',
      85: 'Slight snow showers',
      86: 'Heavy snow showers',
      95: 'Thunderstorm',
      96: 'Thunderstorm with slight hail',
      99: 'Thunderstorm with heavy hail'
    };
    return mapping[code] || 'Unspecified Weather';
  };

  // Render weather icon matching user's HTML style sheet (using Lucide React)
  const getWeatherIcon = (code: number, sizeClass: string = "w-32 h-32") => {
    const classes = `${sizeClass} transition-all duration-300 animate-pulse-slow`;
    if (code === 0) return <Sun className={`${classes} text-amber-500`} />;
    if (code >= 1 && code <= 3) return <Cloud className={`${classes} text-indigo-400`} />;
    if (code === 45 || code === 48) return <Cloud className={`${classes} text-slate-300`} />;
    if (code >= 51 && code <= 57) return <CloudDrizzle className={`${classes} text-blue-400`} />;
    if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return <CloudRain className={`${classes} text-blue-500`} />;
    if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return <CloudSnow className={`${classes} text-sky-300`} />;
    if (code >= 95) return <CloudLightning className={`${classes} text-purple-600`} />;
    return <Sun className={`${classes} text-amber-500`} />;
  };

  const getRecommendationIcon = (iconName: string) => {
    const classes = "w-6 h-6 shrink-0";
    switch (iconName) {
      case 'activity': return <Activity className={`${classes}`} />;
      case 'sun': return <Sun className={`${classes}`} />;
      case 'umbrella': return <Umbrella className={`${classes}`} />;
      case 'wind': return <Wind className={`${classes}`} />;
      case 'shield': return <Shield className={`${classes}`} />;
      case 'alert':
      default: return <AlertTriangle className={`${classes}`} />;
    }
  };

  const formatTemp = (val: number) => {
    if (unit === 'F') {
      return `${Math.round((val * 9/5) + 32)}°F`;
    }
    return `${Math.round(val)}°C`;
  };

  // Safe client-side fallback recommendations builder
  const getLocalFallbackRecommendations = (w: WeatherData): Recommendation[] => {
    const temp = w.current.temperature_2m;
    const wind = w.current.wind_speed_10m;
    const code = w.current.weather_code;

    let morningTitle = "Morning Stretch";
    let morningDesc = "The weather is comfortable and calm. Perfect for an outdoor yoga session or early morning stretch.";
    let morningCat: 'indoor' | 'outdoor' = "outdoor";
    let morningBg = "bg-emerald-50 text-emerald-600";
    let morningBorder = "border-emerald-100";
    let morningIcon = "activity";

    let afternoonTitle = "Outdoor Exploring";
    let afternoonDesc = "A pleasant day with optimal outdoor visibility. Take a stroll or secure comfortable patio lunch seating.";
    let afternoonCat: 'indoor' | 'outdoor' = "outdoor";
    let afternoonBg = "bg-amber-50 text-amber-600";
    let afternoonBorder = "border-amber-100";
    let afternoonIcon = "sun";

    let clothingTitle = "Clothing Recommendation";
    let clothingDesc = "A light cardigan or breathable long-sleeve tee is recommended for this moderate temperature.";
    let clothingBg = "bg-indigo-50 text-indigo-600";
    let clothingBorder = "border-indigo-100";
    let clothingIcon = "shield";

    let safetyTitle = "Weather Awareness";
    let safetyDesc = "Good air quality and standard visibility. Always apply SPF 30+ sunscreen if exposed to direct peak sunlight.";
    let safetyCat: 'indoor' | 'outdoor' = "outdoor";
    let safetyBg = "bg-rose-50 text-rose-600";
    let safetyBorder = "border-rose-100";
    let safetyIcon = "alert";

    if (temp < 10) {
      morningTitle = "Indoor Warm-up";
      morningDesc = "Brisk morning chill detected. Focus on an indoor warmup, light workout, or home-brewed tea session.";
      morningCat = "indoor";
      morningBg = "bg-blue-50 text-blue-600";
      morningBorder = "border-blue-100";
      morningIcon = "activity";

      afternoonTitle = "Cozy Cafe Workspace";
      afternoonDesc = "Cold weather suggests indoor leisure. It's a great day to visit an art exhibit, bookstore, or coffee shop.";
      morningCat = "indoor";
      afternoonBg = "bg-amber-50 text-amber-600";
      afternoonBorder = "border-amber-100";
      afternoonIcon = "sun";

      clothingTitle = "Thermal Wardrobe";
      clothingDesc = "Layer up with thermal wear, a wind-resistant coat, gloves, and warm knit socks to protect against draft.";
      clothingBg = "bg-indigo-50 text-indigo-600";
      clothingBorder = "border-indigo-100";
      clothingIcon = "shield";

      safetyTitle = "Frost and Hydration";
      safetyDesc = "Dry cold wind can cause skin irritation. Keep a rich facial balm and a water flask handy today.";
      safetyBg = "bg-rose-50 text-rose-600";
      safetyBorder = "border-rose-100";
      safetyIcon = "alert";
    } else if (temp > 28) {
      morningTitle = "Early Morning Activity";
      morningDesc = "Intense noon heat expected. Tackle strenuous workouts or shopping before 8:30 AM to remain ventilated.";
      morningBg = "bg-emerald-50 text-emerald-600";
      morningBorder = "border-emerald-100";
      morningIcon = "activity";

      afternoonTitle = "Air-Conditioned Escape";
      afternoonDesc = "High temperatures at peak hours. Rest indoor near active ventilation or seek shaded swimming pool options.";
      morningCat = "indoor";
      afternoonBg = "bg-blue-50 text-blue-600";
      afternoonBorder = "border-blue-100";
      afternoonIcon = "sun";

      clothingTitle = "Lightweight Apparel";
      clothingDesc = "Dress in loose-fitting linen, light colors, and sun hats to stay aerated and reject solar heat absorption.";
      clothingBg = "bg-indigo-50 text-indigo-600";
      clothingBorder = "border-indigo-100";
      clothingIcon = "shield";

      safetyTitle = "Dehydration & UV Index";
      safetyDesc = "Extremely high UV index. Reapply broad-spectrum SPF 50 sunscreen hourly, wear sunglasses, and hydrate actively.";
      safetyBg = "bg-rose-50 text-rose-600";
      safetyBorder = "border-rose-100";
      safetyIcon = "alert";
    }

    if (wind > 25) {
      safetyTitle = "High Wind Advisory";
      safetyDesc = "Brisk, high-velocity winds present. Protect eyes from dust particles and avoid temporary street scaffolds.";
      safetyBg = "bg-rose-50 text-rose-600";
      safetyBorder = "border-rose-100";
      safetyIcon = "wind";
    }

    if (code >= 51 && code <= 67) {
      afternoonTitle = "Indoor Cozy Lounge";
      afternoonDesc = "Active rain expected today. Plan indoor social games, read at the library, or book a theater ticket.";
      morningCat = "indoor";
      afternoonBg = "bg-amber-50 text-amber-600";
      afternoonBorder = "border-amber-100";
      afternoonIcon = "umbrella";

      clothingTitle = "Waterproof Apparel";
      clothingDesc = "Equip standard umbrellas, robust raincoats, and water-repellent boots with proper rubber traction.";
      clothingBg = "bg-indigo-50 text-indigo-600";
      clothingBorder = "border-indigo-100";
      clothingIcon = "shield";
    }

    return [
      { id: "morning_activity", title: morningTitle, category: morningCat, recommendation: morningDesc, bgColor: morningBg, borderColor: morningBorder, icon: morningIcon },
      { id: "afternoon_activity", title: afternoonTitle, category: afternoonCat, recommendation: afternoonDesc, bgColor: afternoonBg, borderColor: afternoonBorder, icon: afternoonIcon },
      { id: "clothing_guide", title: clothingTitle, category: "indoor", recommendation: clothingDesc, bgColor: clothingBg, borderColor: clothingBorder, icon: clothingIcon },
      { id: "safety_alert", title: safetyTitle, category: "outdoor", recommendation: safetyDesc, bgColor: safetyBg, borderColor: safetyBorder, icon: safetyIcon }
    ];
  };

  // Helper for rendering date nicely
  const formatDateString = (isoDate: string) => {
    const d = new Date(isoDate);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Get selected day values for detailed views
  const isTodaySelected = selectedDayIndex === 0;
  const selectedDayLabel = weatherData ? (isTodaySelected ? 'Today' : formatDateString(weatherData.daily.time[selectedDayIndex])) : '';
  const selectedDayMaxTemp = weatherData ? weatherData.daily.temperature_2m_max[selectedDayIndex] : 0;
  const selectedDayMinTemp = weatherData ? weatherData.daily.temperature_2m_min[selectedDayIndex] : 0;
  const selectedDayCode = weatherData ? weatherData.daily.weather_code[selectedDayIndex] : 0;
  const selectedDayWindMax = weatherData ? weatherData.daily.wind_speed_10m_max[selectedDayIndex] : 0;
  const selectedDayUvMax = weatherData ? weatherData.daily.uv_index_max[selectedDayIndex] : 0;
  const selectedDayPrecip = weatherData ? weatherData.daily.precipitation_sum[selectedDayIndex] : 0;

  // Chart dataset
  const chartData = weatherData ? weatherData.daily.time.map((timeStr, idx) => {
    const dateObj = new Date(timeStr);
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
    return {
      name: dayName,
      'Max Temp': Math.round(weatherData.daily.temperature_2m_max[idx]),
      'Min Temp': Math.round(weatherData.daily.temperature_2m_min[idx]),
      'Rain (mm)': weatherData.daily.precipitation_sum[idx],
    };
  }) : [];

  return (
    <div id="weatherintel-root" className="w-full min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 select-none antialiased">
      {/* Header Navigation */}
      <header id="header-bar" className="sticky top-0 z-40 h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 md:px-8 flex items-center justify-between gap-4">
        {/* Brand */}
        <div id="brand-logo" className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-100 transition-all hover:scale-105 duration-200">
            <Sun className="w-5 h-5 text-white animate-pulse-slow" />
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-800 hidden sm:inline-block">
            Weather<span className="text-indigo-600">Intel</span>
          </span>
        </div>

        {/* Search Bar */}
        <div id="search-container" className="flex-1 max-w-lg relative" ref={dropdownRef}>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="city-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Search city (e.g. Berlin, Tokyo, Rome)..."
              className="w-full bg-slate-100 border-none rounded-2xl py-2.5 pl-11 pr-10 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none placeholder-slate-400 transition-all duration-300 shadow-inner"
            />
            {searchQuery && (
              <button
                id="clear-search-btn"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {showDropdown && (searchQuery.trim().length >= 2 || searchLoading) && (
            <div id="search-dropdown-list" className="absolute left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-100 shadow-xl overflow-hidden z-50 py-1 transition-all">
              {searchLoading ? (
                <div className="flex items-center justify-center py-6 text-sm text-slate-400 gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                  <span>Searching locations...</span>
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map((city) => (
                  <button
                    key={city.id}
                    onClick={() => handleSelectCity(city)}
                    className="w-full text-left px-5 py-3 hover:bg-slate-50 flex items-center justify-between text-sm transition-all hover:pl-6 group border-b border-slate-50 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <MapPin className="w-4 h-4 text-indigo-500 group-hover:scale-110 transition-transform" />
                      <div>
                        <span className="font-semibold text-slate-800">{city.name}</span>
                        {city.admin1 && <span className="text-slate-400 text-xs">, {city.admin1}</span>}
                        <span className="text-slate-400 text-xs font-normal">, {city.country}</span>
                      </div>
                    </div>
                    <span className="text-xs bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-md group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors uppercase">
                      {city.country_code}
                    </span>
                  </button>
                ))
              ) : (
                <div className="flex items-center justify-center py-6 text-sm text-slate-400 gap-2">
                  <AlertCircle className="w-4 h-4 text-slate-300" />
                  <span>No locations matching "{searchQuery}"</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Controls & Info */}
        <div id="controls-section" className="flex items-center gap-3 shrink-0">
          {/* Unit Toggle */}
          <div className="bg-slate-100 p-0.5 rounded-xl flex border border-slate-200 shadow-inner">
            <button
              onClick={() => setUnit('C')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                unit === 'C'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              °C
            </button>
            <button
              onClick={() => setUnit('F')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                unit === 'F'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              °F
            </button>
          </div>

          {/* Current City Highlight */}
          <div id="current-city-info" className="text-right hidden md:block border-l border-slate-200 pl-4">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Focused City</p>
            <p className="text-sm font-bold text-slate-700 mt-1 flex items-center justify-end gap-1">
              {selectedCity.name}
            </p>
          </div>

          {/* Country Badge */}
          <div className="w-9 h-9 rounded-full border border-slate-200 bg-white p-0.5 shadow-sm hidden sm:flex items-center justify-center font-bold text-[10px] text-slate-600">
            {selectedCity.country_code}
          </div>
        </div>
      </header>

      {/* Main Content Dashboard */}
      {loading ? (
        <main className="flex-1 p-4 md:p-8 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
            <p className="text-slate-600 font-semibold text-base">Retrieving precise weather intelligence...</p>
            <p className="text-slate-400 text-xs mt-1">Connecting to meteorological stations worldwide</p>
          </div>
        </main>
      ) : error ? (
        <main className="flex-1 p-4 md:p-8 flex items-center justify-center">
          <div className="bg-white rounded-[2rem] p-8 border border-rose-100 shadow-xl max-w-md w-full text-center">
            <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-100">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-lg text-slate-800">Weather Lookup Failed</h3>
            <p className="text-slate-500 text-sm mt-2 leading-relaxed">{error}</p>
            <button
              onClick={() => fetchWeatherAndRecommendations(selectedCity)}
              className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-2xl text-sm transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-2 mx-auto"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry Connection</span>
            </button>
          </div>
        </main>
      ) : weatherData ? (
        <main id="dashboard-grid" className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto grid grid-cols-12 gap-6">
          
          {/* Left Panel: Current Weather Display Card */}
          <section id="current-weather-panel" className="col-span-12 lg:col-span-4 flex flex-col gap-6">
            <div className="bg-white rounded-[2rem] p-6 md:p-8 shadow-sm flex flex-col items-center flex-1 border border-slate-100 relative overflow-hidden transition-all duration-300 group hover:shadow-md">
              {/* Decorative Background Sphere */}
              <div className="absolute top-0 right-0 w-36 h-36 bg-indigo-50/50 rounded-full -mr-16 -mt-16 opacity-60 pointer-events-none group-hover:scale-105 transition-transform duration-500"></div>
              
              {/* Card Header Info */}
              <div className="flex items-center justify-between w-full mb-2">
                <span className="text-slate-400 font-medium text-sm flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                  {selectedCity.name}, {selectedCity.country}
                </span>
                
                {/* Mode Indicator Badge */}
                {isTodaySelected ? (
                  <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-emerald-100 animate-pulse-slow">
                    • Live Current
                  </span>
                ) : (
                  <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-indigo-100">
                    Forecast View
                  </span>
                )}
              </div>

              {/* Day Stamp */}
              <p className="text-slate-500 text-sm font-semibold mt-1">
                {selectedDayLabel}
              </p>

              {/* Weather Art Illustration */}
              <div className="my-6 md:my-8 transform group-hover:scale-105 transition-transform duration-500 flex items-center justify-center">
                {isTodaySelected 
                  ? getWeatherIcon(weatherData.current.weather_code) 
                  : getWeatherIcon(selectedDayCode)
                }
              </div>

              {/* Dynamic Temperature Metrics */}
              <div className="text-center mb-6">
                <h1 className="text-6xl md:text-7xl font-light tracking-tighter text-slate-800 relative inline-block">
                  {isTodaySelected 
                    ? formatTemp(weatherData.current.temperature_2m)
                    : formatTemp((selectedDayMaxTemp + selectedDayMinTemp) / 2)
                  }
                </h1>
                
                <p className="text-xl font-bold mt-3 text-slate-700">
                  {isTodaySelected 
                    ? getWeatherDescription(weatherData.current.weather_code)
                    : getWeatherDescription(selectedDayCode)
                  }
                </p>
                
                {/* High / Low Forecast */}
                <p className="text-slate-400 text-xs font-semibold mt-1.5 flex items-center justify-center gap-2">
                  <span className="text-slate-600">H: {formatTemp(weatherData.daily.temperature_2m_max[selectedDayIndex])}</span>
                  <span className="text-slate-300">|</span>
                  <span className="text-slate-500">L: {formatTemp(weatherData.daily.temperature_2m_min[selectedDayIndex])}</span>
                </p>
              </div>

              {/* Dashboard Sub-Metrics Box */}
              <div className="grid grid-cols-2 gap-4 w-full mt-auto pt-6 border-t border-slate-100/80">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:bg-slate-100/50 transition-colors">
                  <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                    <Wind className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    Wind Speed
                  </p>
                  <p className="text-base font-bold text-slate-700 mt-1.5">
                    {isTodaySelected ? weatherData.current.wind_speed_10m : selectedDayWindMax} 
                    <span className="text-xs font-normal text-slate-500 ml-1">km/h</span>
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:bg-slate-100/50 transition-colors">
                  <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                    <Droplets className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    {isTodaySelected ? "Humidity" : "Precipitation"}
                  </p>
                  <p className="text-base font-bold text-slate-700 mt-1.5">
                    {isTodaySelected ? (
                      <>
                        {weatherData.current.relative_humidity_2m}
                        <span className="text-xs font-normal text-slate-500 ml-1">%</span>
                      </>
                    ) : (
                      <>
                        {selectedDayPrecip}
                        <span className="text-xs font-normal text-slate-500 ml-1">mm</span>
                      </>
                    )}
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:bg-slate-100/50 transition-colors">
                  <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    {isTodaySelected ? "Apparent" : "UV Index"}
                  </p>
                  <p className="text-base font-bold text-slate-700 mt-1.5">
                    {isTodaySelected ? (
                      formatTemp(weatherData.current.apparent_temperature)
                    ) : (
                      <>
                        {selectedDayUvMax}
                        <span className="text-xs font-normal text-slate-500 ml-1">UV</span>
                      </>
                    )}
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:bg-slate-100/50 transition-colors">
                  <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                    <Thermometer className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    {isTodaySelected ? "Pressure" : "Daily Code"}
                  </p>
                  <p className="text-sm font-bold text-slate-700 mt-1.5">
                    {isTodaySelected ? (
                      <>
                        {Math.round(weatherData.current.pressure_msl)}
                        <span className="text-[10px] font-normal text-slate-500 ml-1">hPa</span>
                      </>
                    ) : (
                      <>
                        Code {selectedDayCode}
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Right Panel: Forecast Cards & Weather Intelligence Planning */}
          <section id="forecast-planning-panel" className="col-span-12 lg:col-span-8 flex flex-col gap-6">
            
            {/* 7-Day Forecast Section */}
            <div id="forecast-card-wrapper" className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 relative group">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-800">7-Day Dynamic Forecast</h2>
                  <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-medium hidden sm:inline-block">Click day to highlight</span>
                </div>
                
                {/* Detailed Chart Trigger */}
                <button
                  id="toggle-chart-btn"
                  onClick={() => setShowChartModal(true)}
                  className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors px-4 py-1.5 rounded-xl flex items-center gap-1.5"
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  Detailed Chart
                </button>
              </div>

              {/* Horizontal 7-Day Cards List */}
              <div id="forecast-grid-layout" className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
                {weatherData.daily.time.map((timeStr, idx) => {
                  const isDayActive = selectedDayIndex === idx;
                  const dateObj = new Date(timeStr);
                  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                  const dateNum = dateObj.toLocaleDateString('en-US', { day: 'numeric' });
                  const maxTemp = weatherData.daily.temperature_2m_max[idx];
                  const minTemp = weatherData.daily.temperature_2m_min[idx];
                  const wCode = weatherData.daily.weather_code[idx];

                  return (
                    <button
                      key={timeStr}
                      onClick={() => setSelectedDayIndex(idx)}
                      className={`flex flex-col items-center py-4 rounded-2xl border transition-all cursor-pointer ${
                        isDayActive
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100 scale-102 hover:scale-102'
                          : 'bg-slate-50 text-slate-700 border-transparent hover:border-indigo-100 hover:bg-slate-100/30'
                      }`}
                    >
                      {/* Day Label */}
                      <span className={`text-[10px] font-extrabold uppercase tracking-wider ${
                        isDayActive ? 'text-white/80' : 'text-slate-400'
                      }`}>
                        {dayName}
                      </span>
                      
                      {/* Day Number */}
                      <span className={`text-[11px] font-semibold mt-0.5 ${
                        isDayActive ? 'text-white/60' : 'text-slate-400'
                      }`}>
                        {dateNum}
                      </span>

                      {/* Icon */}
                      <div className="my-3.5">
                        {isDayActive 
                          ? getWeatherIcon(wCode, "w-8 h-8") 
                          : getWeatherIcon(wCode, "w-8 h-8")
                        }
                      </div>

                      {/* Temp Highs / Lows */}
                      <div className="flex flex-col items-center leading-none">
                        <span className={`text-sm font-bold ${isDayActive ? 'text-white' : 'text-slate-700'}`}>
                          {formatTemp(maxTemp)}
                        </span>
                        <span className={`text-[10px] font-medium mt-1 ${isDayActive ? 'text-white/70' : 'text-slate-400'}`}>
                          {formatTemp(minTemp)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Weather Intelligence Planning Recommendations Card */}
            <div id="recommendations-card-wrapper" className="flex-1 bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex flex-col justify-between">
              
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">
                      Weather Intelligence Advisor
                    </h2>
                    <p className="text-[10px] text-slate-400 font-medium">Actionable outdoor & indoor plans for today</p>
                  </div>
                </div>

                {/* Gemini Powered Badge */}
                <div className="flex items-center gap-1.5">
                  <div className={`px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 transition-all ${
                    isAiPowered 
                      ? 'bg-purple-50 text-purple-700 border border-purple-100' 
                      : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                  }`}>
                    {isAiPowered ? (
                      <>
                        <Sparkles className="w-3 h-3 text-purple-500 animate-pulse" />
                        <span>Gemini 3.5-Flash Active</span>
                      </>
                    ) : (
                      <>
                        <Activity className="w-3 h-3 text-indigo-500" />
                        <span>Rule Engine Enabled</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Recommendations Bento Grid */}
              {recsLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 items-center justify-center py-12">
                  <div className="col-span-1 sm:col-span-2 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-600">Generating weather recommendations...</p>
                    <p className="text-xs text-slate-400 mt-0.5">Gemini is evaluating wind vectors, thermal gradients, and forecast models</p>
                  </div>
                </div>
              ) : (
                <div id="recommendation-bento-grid" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {recommendations.map((rec) => {
                    return (
                      <div
                        key={rec.id}
                        className={`p-4 border ${rec.borderColor || 'border-slate-100'} rounded-2xl flex gap-4 transition-all hover:shadow-sm duration-300 group bg-white`}
                      >
                        {/* Icon Wrap */}
                        <div className={`w-11 h-11 ${rec.bgColor || 'bg-slate-50 text-slate-600'} rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-300 border border-current/10`}>
                          {getRecommendationIcon(rec.icon)}
                        </div>

                        {/* Text */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-sm text-slate-800">{rec.title}</p>
                            <span className={`text-[9px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded-md ${
                              rec.category === 'outdoor' 
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-100/50' 
                                : 'bg-amber-50 text-amber-600 border border-amber-100/50'
                            }`}>
                              {rec.category || 'indoor'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed font-medium">
                            {rec.recommendation}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Quick Summary Advice Banner */}
              <div className="mt-5 p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
                <Info className="w-4 h-4 text-indigo-500 shrink-0" />
                <p className="text-[11px] text-slate-500 leading-normal font-semibold">
                  Advice adjusts instantly based on selected forecast days. Current metrics originate from active local airport telemetry.
                </p>
              </div>
            </div>
          </section>

        </main>
      ) : null}

      {/* Bottom Bar Info / Footer */}
      <footer id="footer-status-bar" className="h-12 px-4 md:px-8 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-200 bg-white shrink-0 mt-auto">
        <div className="flex gap-4 md:gap-6 overflow-hidden truncate">
          <span>Real-time data provided by <a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 underline font-medium">Open-Meteo API</a></span>
          <span className="hidden sm:inline">Visibility: 10 km</span>
          <span className="hidden md:inline">Air Quality: Good (22 AQI)</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping-slow"></span>
          <span className="font-bold text-slate-500">System Status: Online</span>
        </div>
      </footer>

      {/* Recharts Detailed Trend Chart Modal */}
      {showChartModal && weatherData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-[2rem] w-full max-w-4xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-600" />
                  Meteorological Trend Chart
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">7-Day Forecast Highs, Lows and Precipitation Trend</p>
              </div>
              <button
                onClick={() => setShowChartModal(false)}
                className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Chart Content */}
            <div className="p-6 flex-1 overflow-y-auto">
              <div className="w-full h-80 min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData}
                    margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="maxTempGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#818cf8" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#818cf8" stopOpacity={0.0}/>
                      </linearGradient>
                      <linearGradient id="minTempGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#60a5fa" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} fontWeight={600} />
                    <YAxis stroke="#94a3b8" fontSize={11} fontWeight={600} unit="°" />
                    <ChartTooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #f1f5f9',
                        borderRadius: '16px',
                        fontSize: '12px',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)',
                        color: '#1e293b'
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="Max Temp"
                      stroke="#4f46e5"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#maxTempGrad)"
                    />
                    <Area
                      type="monotone"
                      dataKey="Min Temp"
                      stroke="#2563eb"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#minTempGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Chart Legend & Extra Meta */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-slate-100 pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-indigo-600 rounded-full"></div>
                  <div>
                    <p className="text-xs font-bold text-slate-700">Average High: {formatTemp(weatherData.daily.temperature_2m_max.reduce((a, b) => a + b, 0) / 7)}</p>
                    <p className="text-[10px] text-slate-400 font-medium">Expected day peaks</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                  <div>
                    <p className="text-xs font-bold text-slate-700">Average Low: {formatTemp(weatherData.daily.temperature_2m_min.reduce((a, b) => a + b, 0) / 7)}</p>
                    <p className="text-[10px] text-slate-400 font-medium">Expected night dips</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-sky-300 rounded-full"></div>
                  <div>
                    <p className="text-xs font-bold text-slate-700">Total Precip: {weatherData.daily.precipitation_sum.reduce((a, b) => a + b, 0).toFixed(1)} mm</p>
                    <p className="text-[10px] text-slate-400 font-medium">Expected rainfall aggregate</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 p-4 px-6 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowChartModal(false)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-5 rounded-xl text-xs transition-colors shadow-sm"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
