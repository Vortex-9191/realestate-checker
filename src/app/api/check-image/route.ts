import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Scene } from '@/types';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const sceneJson = formData.get('scene') as string;
    const fileType = formData.get('fileType') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!sceneJson) {
      return NextResponse.json({ error: 'No scene provided' }, { status: 400 });
    }

    const scene: Scene = JSON.parse(sceneJson);

    // ファイルをbase64に変換
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');

    // MIMEタイプを取得
    const mimeType = file.type || (fileType === 'pdf' ? 'application/pdf' : 'image/jpeg');
    const isPdf = fileType === 'pdf' || mimeType === 'application/pdf';

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro-preview-05-06' });

    const fileTypeText = isPdf ? 'PDF広告' : '画像';
    const prompt = `
あなたは不動産広告の審査の専門家です。
添付された${fileTypeText}が「${scene.name}」として適切かどうかを判定してください。

【シーン情報】
- シーン名: ${scene.name}
- 説明: ${scene.description || 'なし'}
- 判定基準: ${scene.criteria || '特になし'}

以下のJSON形式のみで回答してください（他のテキストは含めないでください）：
{
  "isAppropriate": true または false,
  "confidence": 0.0〜1.0の数値,
  "reason": "判定理由の詳細説明",
  "suggestions": ["改善提案1", "改善提案2"]
}

判定ポイント：
1. ${fileTypeText}が指定されたシーン（${scene.name}）の内容を正しく表しているか
2. 判定基準を満たしているか
3. 不動産広告として適切な品質か${isPdf ? '（表示の正確性、法令遵守など）' : '（明るさ、構図、清潔感など）'}
4. 不適切な${isPdf ? '表記や誤解を招く表現' : '写り込み（個人情報、生活感のある物など）'}がないか
`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType,
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

    const checkResult = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      scene,
      ...checkResult,
    });
  } catch (error) {
    console.error('File check error:', error);
    return NextResponse.json(
      { error: 'Failed to check file' },
      { status: 500 }
    );
  }
}
