import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Initialize Gemini SDK securely
const geminiApiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (geminiApiKey) {
  ai = new GoogleGenAI({
    apiKey: geminiApiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Convert WMO Weather Interpretation Codes to readable descriptions
function getWeatherConditionText(code: number): string {
  const mapping: { [key: number]: string } = {
    0: 'Clear sky',
    1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Depositing rime fog',
    51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
    56: 'Light freezing drizzle', 57: 'Dense freezing drizzle',
    61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
    66: 'Light freezing rain', 67: 'Heavy freezing rain',
    71: 'Slight snow fall', 73: 'Moderate snow fall', 75: 'Heavy snow fall',
    77: 'Snow grains',
    80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
    85: 'Slight snow showers', 86: 'Heavy snow showers',
    95: 'Thunderstorm', 96: 'Thunderstorm with slight hail', 99: 'Thunderstorm with heavy hail'
  };
  return mapping[code] || 'Unknown weather conditions';
}

// Rule-based fallback generator for weather recommendations
function getFallbackRecommendations(temp: number, wind: number, code: number) {
  let morningTitle = "Morning Jogging";
  let morningDesc = "Temperatures are cool and perfect for an outdoor run or morning stretch.";
  let morningCategory = "outdoor";
  let morningBg = "bg-emerald-50 text-emerald-600";
  let morningBorder = "border-emerald-100";
  let morningIcon = "activity";

  let afternoonTitle = "Outdoor Dining";
  let afternoonDesc = "Enjoy an early afternoon walk or lunch at a local patio with pleasant weather.";
  let afternoonCategory = "outdoor";
  let afternoonBg = "bg-amber-50 text-amber-600";
  let afternoonBorder = "border-amber-100";
  let afternoonIcon = "sun";

  let clothingTitle = "Clothing Guide";
  let clothingDesc = "A light sweater or breathable layers would be highly comfortable today.";
  let clothingCategory = "indoor";
  let clothingBg = "bg-indigo-50 text-indigo-600";
  let clothingBorder = "border-indigo-100";
  let clothingIcon = "shield";

  let safetyTitle = "UV & Weather Safety";
  let safetyDesc = "Moderate UV levels. SPF 30 sunscreen and sunglasses are recommended during peak hours.";
  let safetyCategory = "outdoor";
  let safetyBg = "bg-rose-50 text-rose-600";
  let safetyBorder = "border-rose-100";
  let safetyIcon = "alert";

  // Temperature rules
  if (temp < 10) {
    morningTitle = "Indoor Warm-up";
    morningDesc = "Chilly morning! Swap your outdoor run for indoor yoga or stretching to stay cozy.";
    morningCategory = "indoor";
    morningBg = "bg-blue-50 text-blue-600";
    morningBorder = "border-blue-100";
    morningIcon = "activity";

    afternoonTitle = "Museum or Cafe Visit";
    afternoonDesc = "Cold outside. A perfect afternoon to visit a museum or relax at a warm coffee shop.";
    afternoonCategory = "indoor";
    afternoonBg = "bg-amber-50 text-amber-600";
    afternoonBorder = "border-amber-100";
    afternoonIcon = "sun";

    clothingTitle = "Thermal Layering";
    clothingDesc = "Dress warmly in a thick winter jacket, gloves, and a scarf to preserve body heat.";
    clothingBg = "bg-indigo-50 text-indigo-600";
    clothingBorder = "border-indigo-100";
    clothingIcon = "shield";

    safetyTitle = "Cold Prevention";
    safetyDesc = "Dry cold air can irritate skin. Stay hydrated and protect sensitive areas from frostbite.";
    safetyCategory = "indoor";
    safetyBg = "bg-rose-50 text-rose-600";
    safetyBorder = "border-rose-100";
    safetyIcon = "alert";
  } else if (temp > 28) {
    morningTitle = "Early Morning Activity";
    morningDesc = "Hot day ahead! Complete outdoor activities before 9:00 AM to beat the intense heat.";
    morningCategory = "outdoor";
    morningBg = "bg-emerald-50 text-emerald-600";
    morningBorder = "border-emerald-100";
    morningIcon = "activity";

    afternoonTitle = "Cool Indoor Escape";
    afternoonDesc = "Extreme midday heat. Plan to spend your afternoon in air-conditioned spaces or shaded pools.";
    afternoonCategory = "indoor";
    afternoonBg = "bg-blue-50 text-blue-600";
    afternoonBorder = "border-blue-100";
    afternoonIcon = "sun";

    clothingTitle = "Lightweight Fabrics";
    clothingDesc = "Wear loose, light-colored cotton or linen clothing to stay cool and ventilated.";
    clothingBg = "bg-indigo-50 text-indigo-600";
    clothingBorder = "border-indigo-100";
    clothingIcon = "shield";

    safetyTitle = "Heat Hydration Alert";
    safetyDesc = "Drink plenty of water! Apply high SPF sunscreen and avoid direct sun between 11 AM - 3 PM.";
    safetyCategory = "outdoor";
    safetyBg = "bg-rose-50 text-rose-600";
    safetyBorder = "border-rose-100";
    safetyIcon = "alert";
  }

  // Wind conditions
  if (wind > 25) {
    safetyTitle = "High Wind Hazard";
    safetyDesc = "Strong winds detected. Secure loose outdoor objects and watch for falling branches.";
    safetyCategory = "outdoor";
    safetyBg = "bg-rose-50 text-rose-600";
    safetyBorder = "border-rose-100";
    safetyIcon = "wind";
  }

  // Rain / thunderstorm / snow codes (WMO interpretations)
  if (code >= 51 && code <= 67) { // Drizzle or Rain
    afternoonTitle = "Indoor Entertainment";
    afternoonDesc = "Showers expected. Swap outdoor plans for board games, reading, or cozy cinema seats.";
    afternoonCategory = "indoor";
    afternoonBg = "bg-amber-50 text-amber-600";
    afternoonBorder = "border-amber-100";
    afternoonIcon = "umbrella";

    clothingTitle = "Rain Gear Protection";
    clothingDesc = "An umbrella, waterproof jacket, and water-resistant footwear are absolute must-haves.";
    clothingBg = "bg-indigo-50 text-indigo-600";
    clothingBorder = "border-indigo-100";
    clothingIcon = "shield";
  } else if (code >= 71 && code <= 86) { // Snow
    afternoonTitle = "Snow Walk";
    afternoonDesc = "Snowing! Great for a short winter walk or building snowmen, followed by hot cocoa.";
    afternoonCategory = "outdoor";
    afternoonBg = "bg-blue-50 text-blue-600";
    afternoonBorder = "border-blue-100";
    afternoonIcon = "umbrella";

    clothingTitle = "Heavy Snow Apparel";
    clothingDesc = "Insulated waterproof boots, water-repellent coat, and thermal innerwear are essential.";
    clothingBg = "bg-indigo-50 text-indigo-600";
    clothingBorder = "border-indigo-100";
    clothingIcon = "shield";
  } else if (code >= 95) { // Thunderstorm
    morningTitle = "Indoor Workspace";
    morningDesc = "Severe thunderstorms nearby. Stay indoors, avoid tall trees, and keep devices unplugged.";
    morningCategory = "indoor";
    morningBg = "bg-emerald-50 text-emerald-600";
    morningBorder = "border-emerald-100";
    morningIcon = "activity";

    safetyTitle = "Lightning Safety Alert";
    safetyDesc = "High risk of lightning! Stay completely indoors and avoid using running water or wired electronics.";
    safetyCategory = "indoor";
    safetyBg = "bg-rose-50 text-rose-600";
    safetyBorder = "border-rose-100";
    safetyIcon = "alert";
  }

  return {
    recommendations: [
      { id: "morning_activity", title: morningTitle, category: morningCategory, recommendation: morningDesc, bgColor: morningBg, borderColor: morningBorder, icon: morningIcon },
      { id: "afternoon_activity", title: afternoonTitle, category: afternoonCategory, recommendation: afternoonDesc, bgColor: afternoonBg, borderColor: afternoonBorder, icon: afternoonIcon },
      { id: "clothing_guide", title: clothingTitle, category: clothingCategory, recommendation: clothingDesc, bgColor: clothingBg, borderColor: clothingBorder, icon: clothingIcon },
      { id: "safety_alert", title: safetyTitle, category: safetyCategory, recommendation: safetyDesc, bgColor: safetyBg, borderColor: safetyBorder, icon: safetyIcon }
    ]
  };
}

app.post('/api/recommendations', async (req, res) => {
  try {
    const { weatherData, city } = req.body;
    if (!weatherData) {
      return res.status(400).json({ error: 'Missing weatherData parameter' });
    }

    const current = weatherData.current || {};
    const daily = weatherData.daily || {};
    const currentTemp = current.temperature_2m ?? 15;
    const currentWind = current.wind_speed_10m ?? 10;
    const currentCode = current.weather_code ?? 0;
    const conditionText = getWeatherConditionText(currentCode);

    if (!ai) {
      console.log('No GEMINI_API_KEY found, using rule-based recommendation engine.');
      return res.json(getFallbackRecommendations(currentTemp, currentWind, currentCode));
    }

    const dailyHighs = daily.temperature_2m_max ?? [currentTemp];
    const dailyLows = daily.temperature_2m_min ?? [currentTemp];
    const dailyCodes = daily.weather_code ?? [currentCode];

    const prompt = `You are a Weather Intelligence assistant.
Analyze the following weather details for ${city || 'the requested city'}:
- Current Temperature: ${currentTemp}°C
- Current Wind Speed: ${currentWind} km/h
- Current Condition: ${conditionText} (code ${currentCode})
- 7-Day Forecast Highs: ${dailyHighs.join(', ')}°C
- 7-Day Forecast Lows: ${dailyLows.join(', ')}°C
- 7-Day Weather Codes: ${dailyCodes.join(', ')}

Please output a JSON object containing exactly 4 customized, highly detailed planning recommendations (morning activity, afternoon/evening activity, clothing advice, and safety/comfort advice) based on this weather.
The JSON must have the following structure:
{
  "recommendations": [
    {
      "id": "morning_activity",
      "title": "Morning Activity",
      "category": "outdoor" or "indoor",
      "recommendation": "A highly descriptive, actionable recommendation explaining why this is perfect based on the specific current conditions (e.g. temperature, sun/clouds, wind) in 1-2 friendly sentences.",
      "bgColor": "bg-emerald-50 text-emerald-600",
      "borderColor": "border-emerald-100",
      "icon": "activity"
    },
    {
      "id": "afternoon_activity",
      "title": "Afternoon/Evening Activity",
      "category": "outdoor" or "indoor",
      "recommendation": "A highly descriptive, actionable recommendation explaining why this is perfect based on afternoon conditions/forecast in 1-2 friendly sentences.",
      "bgColor": "bg-amber-50 text-amber-600",
      "borderColor": "border-amber-100",
      "icon": "sun" or "umbrella" or "activity"
    },
    {
      "id": "clothing_guide",
      "title": "Clothing Guide",
      "category": "indoor" or "outdoor",
      "recommendation": "An expert clothing recommendation tailored for today's high/low temperatures, precipitation, and wind speeds in 1-2 friendly sentences.",
      "bgColor": "bg-indigo-50 text-indigo-600",
      "borderColor": "border-indigo-100",
      "icon": "shield"
    },
    {
      "id": "safety_alert",
      "title": "Safety & Comfort Guide",
      "category": "indoor" or "outdoor",
      "recommendation": "A tailored safety or comfort guide (e.g. UV index, wind chill, storm caution, hydration, humidity concerns) in 1-2 friendly sentences.",
      "bgColor": "bg-rose-50 text-rose-600",
      "borderColor": "border-rose-100",
      "icon": "alert" or "wind"
    }
  ]
}

Ensure the output is valid, parsing-ready JSON and contains NO markdown backticks, prefix or suffix text. Output ONLY the raw JSON string.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('Empty response from Gemini API');
    }

    const cleanedText = text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const result = JSON.parse(cleanedText);
    return res.json(result);

  } catch (error: any) {
    console.error('Error in /api/recommendations:', error);
    const { weatherData } = req.body;
    const currentTemp = weatherData?.current?.temperature_2m || 15;
    const currentWind = weatherData?.current?.wind_speed_10m || 10;
    const currentCode = weatherData?.current?.weather_code || 0;
    return res.json(getFallbackRecommendations(currentTemp, currentWind, currentCode));
  }
});

// Configure Vite middleware in development, or serve static build in production
const port = process.env.PORT || 3000;

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom'
    });
    app.use(vite.middlewares);
    
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = await vite.transformIndexHtml(url, `
          <!doctype html>
          <html lang="en">
            <head>
              <meta charset="UTF-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
              <title>WeatherIntel - Weather Intelligence App</title>
            </head>
            <body>
              <div id="root"></div>
              <script type="module" src="/src/main.tsx"></script>
            </body>
          </html>
        `);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    // Serve production static assets from dist
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

startServer().catch(console.error);
