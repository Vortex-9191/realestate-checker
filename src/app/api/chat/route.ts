import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { CheckResult } from '@/types';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pdfBase64, checkResults, userMessage } = body as {
      pdfBase64: string;
      checkResults: CheckResult[];
      userMessage: string;
    };

    if (!userMessage) {
      return NextResponse.json(
        { error: 'Missing user message' },
        { status: 400 }
      );
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

    const resultsContext = checkResults
      .map(
        (r) =>
          `- ${r.checklistItem?.checkItem || 'チェック項目'}: ${r.status} (${r.detail})`
      )
      .join('\n');

    const prompt = `
あなたは不動産広告規制の専門家AIアシスタントです。
以下の判定結果に基づいて、ユーザーの質問に回答してください。

【判定結果サマリー】
${resultsContext}

【ユーザーの質問】
${userMessage}

分かりやすく簡潔に回答してください。専門用語を使う場合は解説を加えてください。
`;

    const parts: (string | { inlineData: { mimeType: string; data: string } })[] = [prompt];

    if (pdfBase64) {
      parts.push({
        inlineData: {
          mimeType: 'application/pdf',
          data: pdfBase64,
        },
      });
    }

    const result = await model.generateContent(parts);
    const response = result.response.text();

    return NextResponse.json({ response });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json(
      { error: 'Failed to generate response' },
      { status: 500 }
    );
  }
}
