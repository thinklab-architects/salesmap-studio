import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = 'AIzaSyCT_OgUb2fpMnSDBMebsAMhYebSirT7sic';
const address = '台北101';
const center = [121.5654, 25.0330];
const count = 4;

async function testGemini() {
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

        const prompt = `
        你是一個房地產專家。請針對「${address}」（經緯度：${center[1]}, ${center[0]}）
        列出 ${count} 個附近最重要的銷售亮點設施（例如捷運站、商圈、公園、學校、地標）。
        
        請回傳純 JSON 格式，不要有 markdown 標記。格式如下：
        [
          { "name": "設施名稱", "type": "類別(如捷運/商圈/公園)", "minutes": 預估開車分鐘數(整數), "lat": 緯度, "lng": 經度 }
        ]
        
        注意：
        1. 經緯度必須真實且在該地點附近。
        2. minutes 請根據距離估算。
      `;

        console.log('Calling Gemini API...');
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log("Gemini API Response:", text);

        // Clean up markdown if present
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        console.log("Cleaned JSON:", jsonStr);

        const parsed = JSON.parse(jsonStr);
        console.log("Parsed POIs:", parsed);
        console.log("\n✅ SUCCESS! Gemini API is working correctly.");
    } catch (error) {
        console.error("❌ Gemini API Error:", error);
        console.error("Error message:", error.message);
        if (error.stack) {
            console.error("Stack trace:", error.stack);
        }
    }
}

testGemini();
