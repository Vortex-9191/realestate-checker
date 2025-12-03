import { GoogleGenerativeAI } from '@google/generative-ai';
import { AdType, ChecklistItem, CheckResult } from '@/types';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

// PDFをbase64に変換
export async function pdfToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// PDF解析して広告種別を判定
export async function analyzePdfType(pdfBase64: string): Promise<{
  detectedType: AdType;
  confidence: number;
  summary: string;
}> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

  const prompt = `
あなたは不動産広告の専門家です。添付されたPDFファイルを分析し、以下のJSON形式で結果を返してください。

広告の種別を以下から判定してください：
- 売買（新築）
- 売買（中古）
- 賃貸（居住用）
- 賃貸（事業用）
- その他

回答は必ず以下のJSON形式のみで返してください（他のテキストは含めないでください）：
{
  "detectedType": "種別名",
  "confidence": 0.95,
  "summary": "この広告は〇〇の物件広告です。主な特徴として..."
}
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

  // JSONを抽出
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse response');
  }

  return JSON.parse(jsonMatch[0]);
}

// チェックリストに基づいてPDFを判定
export async function checkPdfWithChecklist(
  pdfBase64: string,
  checklist: ChecklistItem[],
  adType: AdType
): Promise<CheckResult[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

  const checklistText = checklist
    .map((item, idx) => `${idx + 1}. [${item.category}] ${item.checkItem} (根拠: ${item.regulation})`)
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

  return rawResults.map((r: { checklistIndex: number; status: 'OK' | 'NG' | '要確認'; detail: string; location?: string }) => ({
    checklistItem: checklist[r.checklistIndex],
    status: r.status,
    detail: r.detail,
    location: r.location,
  }));
}

// チャット応答生成
export async function generateChatResponse(
  pdfBase64: string,
  checkResults: CheckResult[],
  userMessage: string
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

  const resultsContext = checkResults
    .map((r) => `- ${r.checklistItem.checkItem}: ${r.status} (${r.detail})`)
    .join('\n');

  const prompt = `
あなたは不動産広告規制の専門家AIアシスタントです。
以下の判定結果に基づいて、ユーザーの質問に回答してください。

【判定結果サマリー】
${resultsContext}

【ユーザーの質問】
${userMessage}

分かりやすく簡潔に回答してください。
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

  return result.response.text();
}
