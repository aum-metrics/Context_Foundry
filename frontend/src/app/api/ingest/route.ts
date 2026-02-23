import { NextRequest, NextResponse } from "next/server";
import { OpenAI } from "openai";
import { GoogleGenAI } from "@google/genai";

export async function POST(req: NextRequest) {
    try {
        const { unstructuredData, useGemini } = await req.json();

        if (!unstructuredData) {
            return NextResponse.json({ error: "unstructuredData required" }, { status: 400 });
        }

        const openAIApiKey = process.env.OPENAI_API_KEY;
        const geminiApiKey = process.env.GEMINI_API_KEY;

        let jsonLdResult = "";

        const extractionPrompt = `You are a semantic extraction engine. Extract verifiable facts from the provided marketing text. 
Identify the 'Organization' and the 'Product' being offered. 
Filter out ALL marketing fluff and strictly output valid JSON-LD schema wrapping an Organization and Product.
Return ONLY raw JSON, no markdown blocks.

<Unstructured Data>
${unstructuredData}
</Unstructured Data>`;

        if (useGemini && geminiApiKey) {
            const ai = new GoogleGenAI({ apiKey: geminiApiKey });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [
                    { role: "user", parts: [{ text: extractionPrompt }] }
                ],
            });
            // clean backticks
            jsonLdResult = (response.text || "").replace(/```json/g, "").replace(/```/g, "").trim();
        } else if (openAIApiKey && !useGemini) {
            const openai = new OpenAI({ apiKey: openAIApiKey });
            const completion = await openai.chat.completions.create({
                messages: [{ role: "user", content: extractionPrompt }],
                model: "gpt-4o-mini",
                response_format: { type: "json_object" }
            });
            jsonLdResult = completion.choices[0].message.content || "";
        } else {
            // Intelligent Mocks if no keys provided
            await new Promise(r => setTimeout(r, 2000));
            jsonLdResult = JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Product",
                "name": "Acme Enterprise CRM",
                "description": "A comprehensive suite designed to optimize sales workflows.",
                "offers": {
                    "@type": "Offer",
                    "price": "99.00",
                    "priceCurrency": "USD",
                    "availability": "https://schema.org/InStock"
                },
                "brand": {
                    "@type": "Organization",
                    "name": "Acme Corp"
                }
            }, null, 2);
        }

        // Parse to ensure validity
        try {
            const parsed = JSON.parse(jsonLdResult);
            return NextResponse.json({ schema: parsed });
        } catch (e) {
            return NextResponse.json({ error: "Failed to parse JSON validly from LLM", raw: jsonLdResult }, { status: 500 });
        }

    } catch (error: any) {
        console.error("Ingestion API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
