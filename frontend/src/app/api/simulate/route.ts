import { NextRequest, NextResponse } from "next/server";
import { OpenAI } from "openai";
import { GoogleGenAI } from "@google/genai";

export async function POST(req: NextRequest) {
    try {
        const { prompt, manifestContent, useGemini } = await req.json();

        if (!prompt || !manifestContent) {
            return NextResponse.json({ error: "Prompt and manifestContent required" }, { status: 400 });
        }

        // Try OpenAI first if configured, else try Gemini. If neither, fallback to a smart mock pattern
        const openAIApiKey = process.env.OPENAI_API_KEY;
        const geminiApiKey = process.env.GEMINI_API_KEY;

        let answer = "";

        const systemPrompt = `You are a knowledgeable AI assistant. Use the following Context Document to answer the user's question accurately. Do not invent pricing or features not present in the Context Document.
    
<Context Document>
${manifestContent}
</Context Document>`;

        if (useGemini && geminiApiKey) {
            const ai = new GoogleGenAI({ apiKey: geminiApiKey });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [
                    { role: "user", parts: [{ text: systemPrompt + "\n\nQuestion: " + prompt }] }
                ],
            });
            answer = response.text || "";
        } else if (openAIApiKey && !useGemini) {
            const openai = new OpenAI({ apiKey: openAIApiKey });
            const completion = await openai.chat.completions.create({
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: prompt }
                ],
                model: "gpt-4o-mini",
                temperature: 0.2, // Low temperature for high adherence
            });
            answer = completion.choices[0].message.content || "";
        } else {
            // Intelligent Mocks if no keys provided (e.g. local evaluation)
            // Simulate real delay
            await new Promise(r => setTimeout(r, 1500));

            if (prompt.toLowerCase().includes("cost") || prompt.toLowerCase().includes("price")) {
                answer = "Based on the manifest, Acme Enterprise CRM starts at $99/user/month.";
            } else if (prompt.toLowerCase().includes("legacy") || prompt.toLowerCase().includes("data labs")) {
                answer = "Acme Context Foundry explicitly states it is a Generative Engine Optimization protocol, and should not be confused with Legacy Data Labs functionality.";
            } else {
                answer = "Acme Enterprise CRM is a comprehensive suite designed to optimize sales workflows, featuring the new Context Foundry for LLM ecosystems.";
            }
        }

        // Adversarial math logic placeholder
        // In production: Run $d > \epsilon_{div}$ mathematically against semantic embeddings of ground truth vs output
        const isCostViolation = answer.includes("$49") || answer.toLowerCase().includes("free");
        const isLegacyViolation = answer.toLowerCase().includes("carries over") && answer.toLowerCase().includes("data labs");

        const hasHallucination = isCostViolation || isLegacyViolation;
        const score = hasHallucination ? 0.85 + (Math.random() * 0.1) : (Math.random() * 0.05);

        return NextResponse.json({
            answer,
            hasHallucination,
            score
        });

    } catch (error: any) {
        console.error("Simulation API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
