import express from "express";
import cors from "cors";
import { MhahPanchang } from "mhah-panchang";

const app = express();
app.use(cors());
const PORT = process.env.PORT || 5000;

// Route: /panchang?date=2025-10-01&lat=12.9716&lng=77.5946
app.get("/panchang", (req, res) => {
  try {
    const { date, lat, lng } = req.query;

    if (!date || !lat || !lng) {
      return res.status(400).json({ error: "Missing date, lat or lng" });
    }

    const obj = new MhahPanchang();
    const result = obj.calendar(
      new Date(date),
      parseFloat(lat),
      parseFloat(lng)
    );
    const sun = obj.sunTimer(new Date(date), parseFloat(lat), parseFloat(lng));

    res.json({
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
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => console.log(`🌞 Panchang API running on port ${PORT}`));
