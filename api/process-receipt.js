// This is Node.js code that will run on the server.

export default async function handler(request, response) {
  // Only allow POST requests
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  // Get the API key from the secure environment variables
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Server Error: GEMINI_API_KEY is not configured.");
    return response.status(500).json({ error: 'API key not configured on the server.' });
  }

  const { imageData } = request.body;
  if (!imageData) {
    return response.status(400).json({ error: 'No image data provided.' });
  }

  const prompt = "Analyze this receipt image. Extract each line item with its price. Return a JSON array where each object has 'item' (string) and 'price' (number). Ignore taxes, tips, and totals. For example: [{\"item\": \"Burger\", \"price\": 12.50}, {\"item\": \"Fries\", \"price\": 4.00}]";

  const payload = {
    contents: [{
      role: "user",
      parts: [
        { text: prompt },
        { inlineData: { mimeType: "image/jpeg", data: imageData } }
      ]
    }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            item: { type: "STRING" },
            price: { type: "NUMBER" }
          },
          required: ["item", "price"]
        }
      }
    }
  };

  const googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  try {
    console.log("Sending request to Google API...");
    const apiResponse = await fetch(googleApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!apiResponse.ok) {
      const errorBody = await apiResponse.text();
      console.error("Google API Error Response:", errorBody);
      return response.status(apiResponse.status).json({ error: 'Failed to process receipt with Google API. The API returned an error.' });
    }

    const result = await apiResponse.json();
    console.log("Successfully received response from Google API.");

    if (result.candidates && result.candidates[0].content && result.candidates[0].content.parts[0]) {
      const parsedJson = JSON.parse(result.candidates[0].content.parts[0].text);
      // Send the successful result back to the frontend
      console.log("Successfully parsed JSON, sending to client.");
      return response.status(200).json(parsedJson);
    } else {
      console.error("Invalid response structure from Google API:", JSON.stringify(result));
      throw new Error('Could not parse items from the receipt response.');
    }

  } catch (error) {
    console.error('Internal Server Error in function execution:', error);
    return response.status(500).json({ error: `An error occurred while processing the receipt: ${error.message}` });
  }
}
