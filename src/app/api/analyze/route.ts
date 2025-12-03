import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('pdf') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // PDFをbase64に変換
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

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
          data: base64,
        },
      },
    ]);

    const text = result.response.text();

    // JSONを抽出
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse response');
    }

    const analysisResult = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      ...analysisResult,
      pdfBase64: base64,
    });
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze PDF' },
      { status: 500 }
    );
  }
}
