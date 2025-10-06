import express from "express";
import cors from "cors";
import { MhahPanchang } from "mhah-panchang";

const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 5000;

// In-memory cache for panchang data
const panchangCache = new Map();
const tithiSearchCache = new Map();

// Initialize panchang object
const panchangObj = new MhahPanchang();

// Helper function to generate cache key
function getCacheKey(date, lat, lng) {
  return `${date}_${lat}_${lng}`;
}

// Helper function to get panchang data (with caching)
function getPanchangData(date, lat, lng) {
  const cacheKey = getCacheKey(date, lat, lng);

  if (panchangCache.has(cacheKey)) {
    return panchangCache.get(cacheKey);
  }

  try {
    const result = panchangObj.calendar(
      new Date(date),
      parseFloat(lat),
      parseFloat(lng)
    );
    const sun = panchangObj.sunTimer(
      new Date(date),
      parseFloat(lat),
      parseFloat(lng)
    );

    const panchangData = {
      date,
      latitude: lat,
      longitude: lng,
      tithi: result.Tithi.name_en_IN,
      paksha: result.Paksha.name_en_IN,
      nakshatra: result.Nakshatra.name_en_IN,
      yoga: result.Yoga.name_en_IN,
      karna: result.Karna.name_en_IN,
      masa: result.Masa.name_en_IN,
      raasi: result.Raasi.name_en_UK,
      ritu: result.Ritu.name_en_UK,
      sunrise: sun.sunRise,
      sunset: sun.sunSet,
    };

    // Cache the result
    panchangCache.set(cacheKey, panchangData);
    return panchangData;
  } catch (error) {
    throw new Error(`Failed to calculate panchang: ${error.message}`);
  }
}

// Helper function to get all dates in current year
function getDatesInCurrentYear() {
  const currentYear = new Date().getFullYear();
  const dates = [];

  for (let month = 1; month <= 12; month++) {
    const daysInMonth = new Date(currentYear, month, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentYear}-${month.toString().padLeft(2, "0")}-${day
        .toString()
        .padLeft(2, "0")}`;
      dates.push(dateStr);
    }
  }

  return dates;
}

// String padding helper
String.prototype.padLeft = function (length, character) {
  return (Array(length).join(character) + this).slice(-length);
};

// Route: Get panchang for specific date
app.get("/panchang", (req, res) => {
  try {
    const { date, lat, lng } = req.query;

    if (!date || !lat || !lng) {
      return res.status(400).json({ error: "Missing date, lat or lng" });
    }

    const result = getPanchangData(date, lat, lng);
    res.json(result);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Route: Pre-cache current year data for a specific location
app.post("/cache-year", (req, res) => {
  try {
    const { lat, lng } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ error: "Missing lat or lng" });
    }

    const dates = getDatesInCurrentYear();
    let cachedCount = 0;

    // Process in batches to avoid blocking
    const batchSize = 50;
    let currentBatch = 0;

    const processBatch = () => {
      const startIdx = currentBatch * batchSize;
      const endIdx = Math.min(startIdx + batchSize, dates.length);

      for (let i = startIdx; i < endIdx; i++) {
        const date = dates[i];
        const cacheKey = getCacheKey(date, lat, lng);

        if (!panchangCache.has(cacheKey)) {
          try {
            getPanchangData(date, lat, lng);
            cachedCount++;
          } catch (error) {
            console.error(`Error caching ${date}:`, error.message);
          }
        }
      }

      currentBatch++;

      if (endIdx < dates.length) {
        // Process next batch asynchronously
        setImmediate(processBatch);
      }
    };

    // Start processing batches
    processBatch();

    res.json({
      message: "Year caching started",
      totalDates: dates.length,
      location: `${lat}, ${lng}`,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Route: Search for all dates with a specific tithi in current year
app.get("/search-tithi", (req, res) => {
  try {
    const { tithi, lat, lng } = req.query;

    if (!tithi || !lat || !lng) {
      return res.status(400).json({ error: "Missing tithi, lat or lng" });
    }

    const searchKey = `${tithi}_${lat}_${lng}`;

    // Check cache first
    if (tithiSearchCache.has(searchKey)) {
      return res.json(tithiSearchCache.get(searchKey));
    }

    const dates = getDatesInCurrentYear();
    const matchingDates = [];

    for (const date of dates) {
      try {
        const panchangData = getPanchangData(date, lat, lng);

        // Case-insensitive tithi matching
        if (
          panchangData.tithi &&
          panchangData.tithi.toLowerCase() === tithi.toLowerCase()
        ) {
          matchingDates.push({
            date: panchangData.date,
            tithi: panchangData.tithi,
            paksha: panchangData.paksha,
            nakshatra: panchangData.nakshatra,
            sunrise: panchangData.sunrise,
            sunset: panchangData.sunset,
          });
        }
      } catch (error) {
        console.error(`Error processing ${date}:`, error.message);
      }
    }

    const result = {
      tithi,
      location: `${lat}, ${lng}`,
      totalMatches: matchingDates.length,
      dates: matchingDates,
    };

    // Cache the search result
    tithiSearchCache.set(searchKey, result);

    res.json(result);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Route: Get all unique tithis for current year (for search suggestions)
app.get("/tithis", (req, res) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: "Missing lat or lng" });
    }

    const tithis = new Set();
    const dates = getDatesInCurrentYear();

    // Sample some dates to get available tithis (performance optimization)
    const sampleDates = dates.filter((_, index) => index % 15 === 0); // Every 15th date

    for (const date of sampleDates) {
      try {
        const panchangData = getPanchangData(date, lat, lng);
        if (panchangData.tithi) {
          tithis.add(panchangData.tithi);
        }
      } catch (error) {
        console.error(`Error processing ${date}:`, error.message);
      }
    }

    res.json({
      tithis: Array.from(tithis).sort(),
      location: `${lat}, ${lng}`,
      note: "Based on sample dates from current year",
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Route: Get cache statistics
app.get("/cache-stats", (req, res) => {
  res.json({
    panchangCacheSize: panchangCache.size,
    tithiSearchCacheSize: tithiSearchCache.size,
    message: "Cache statistics",
  });
});

// Route: Clear cache
app.delete("/cache", (req, res) => {
  panchangCache.clear();
  tithiSearchCache.clear();
  res.json({ message: "Cache cleared successfully" });
});

app.listen(PORT, () => console.log(`🌞 Panchang API running on port ${PORT}`));
