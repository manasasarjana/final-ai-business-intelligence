const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "AIzaSyDeCNKBxsmzcpaZqSrvO4Ao9aEE_bnCssA");

async function run() {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Hello");
        console.log("Success with gemini-1.5-flash!");
    } catch (error) {
        console.error("Error with gemini-1.5-flash:", error.message);
    }
}

run();
