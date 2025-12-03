import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ChecklistItem } from '@/types';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pdfBase64, checklist, adType } = body as {
      pdfBase64: string;
      checklist: ChecklistItem[];
      adType: string;
    };

    if (!pdfBase64 || !checklist || !adType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

    const checklistText = checklist
      .map(
        (item, idx) =>
          `${idx + 1}. [ID:${item.id}][${item.category}] ${item.checkItem} (根拠: ${item.regulation})`
      )
      .join('\n');

    const prompt = `
あなたは不動産広告規制の専門家です。添付されたPDF（${adType}の広告）を以下のチェックリストに基づいて審査してください。

【チェックリスト】
${checklistText}

各項目について以下のJSON配列形式で判定結果を返してください（他のテキストは含めないでください）：
[
  {
    "checklistIndex": 0,
    "status": "OK" | "NG" | "要確認",
    "detail": "判定理由の詳細説明",
    "location": "問題箇所（該当する場合）"
  },
  ...
]

判定基準：
- OK: 基準を満たしている
- NG: 明らかに基準違反
- 要確認: 情報不足または曖昧な場合
`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: pdfBase64,
        },
      },
    ]);

    const text = result.response.text();

    // JSON配列を抽出
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Failed to parse response');
    }

    const rawResults = JSON.parse(jsonMatch[0]);

    const checkResults = rawResults.map(
      (r: {
        checklistIndex: number;
        status: 'OK' | 'NG' | '要確認';
        detail: string;
        location?: string;
      }) => ({
        checklistItem: checklist[r.checklistIndex],
        status: r.status,
        detail: r.detail,
        location: r.location,
      })
    );

    return NextResponse.json({ results: checkResults });
  } catch (error) {
    console.error('Check error:', error);
    return NextResponse.json(
      { error: 'Failed to check PDF' },
      { status: 500 }
    );
  }
}
