/**
 * Scan a shift schedule photo with Gemini Vision and return extracted shifts as JSON.
 * Requires VITE_GEMINI_API_KEY in env.
 */

export interface ParsedShiftRow {
  name: string;
  date: string;
  start_time: string;
  end_time: string;
}

const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const PROMPT = `Extract all shift entries from this schedule image. For each entry return: name (person first name or full name), date (YYYY-MM-DD), start_time (HH:mm), end_time (HH:mm).
Return ONLY a valid JSON array, no other text. Example: [{"name":"Marco","date":"2026-03-10","start_time":"10:00","end_time":"16:00"},{"name":"Anna","date":"2026-03-10","start_time":"19:00","end_time":"23:00"}]
If you cannot read any shifts, return [].`;

function fileToBase64(file: File): Promise<{ data: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      const mimeType = file.type || 'image/jpeg';
      resolve({ data: base64, mimeType });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Normalize date string to YYYY-MM-DD. Accepts 2026-03-10, 10/03/2026, 10.03.2026. */
function normalizeDate(s: string): string {
  const v = (s || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  if (!Number.isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return v;
}

/** Normalize time to HH:mm. */
function normalizeTime(s: string): string {
  const v = (s || '').trim().slice(0, 5);
  if (/^\d{1,2}:\d{2}$/.test(v)) {
    const [h, m] = v.split(':').map(Number);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  if (/^\d{1,2}$/.test(v)) return `${v.padStart(2, '0')}:00`;
  return v || '10:00';
}

/**
 * Call Gemini Vision API and parse response into ParsedShiftRow[].
 */
export async function scanShiftsFromPhoto(file: File): Promise<ParsedShiftRow[]> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('VITE_GEMINI_API_KEY non configurato. Aggiungilo in .env');
  }

  const { data, mimeType } = await fileToBase64(file);

  const body = {
    contents: [{
      parts: [
        { inline_data: { mime_type: mimeType, data } },
        { text: PROMPT },
      ],
    }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  };

  const res = await fetch(`${GEMINI_API}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error: ${res.status} ${err}`);
  }

  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    return [];
  }

  const raw = text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
  let arr: unknown[];
  try {
    arr = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];

  return arr
    .filter((item): item is Record<string, unknown> => item != null && typeof item === 'object')
    .map((item) => ({
      name: String(item.name ?? '').trim(),
      date: normalizeDate(String(item.date ?? '')),
      start_time: normalizeTime(String(item.start_time ?? item.start ?? '')),
      end_time: normalizeTime(String(item.end_time ?? item.end ?? '')),
    }))
    .filter((row) => row.name && row.date);
}
