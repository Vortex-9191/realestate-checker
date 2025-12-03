import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Scene } from '@/types';

// Route Segment Config for App Router
export const runtime = 'nodejs';
export const maxDuration = 60;

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

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

    const fileTypeText = isPdf ? 'PDF広告' : '画像';
    const tagsText = scene.objectTags.length > 0 ? scene.objectTags.join(', ') : 'なし';
    const prompt = `
あなたは不動産広告の審査の専門家です。
添付された${fileTypeText}が以下のチェック項目を満たしているかを判定してください。

【チェック項目情報】
- シーン種別: ${scene.sceneType}
- サブシーン: ${scene.subScene || 'なし'}
- カテゴリ: ${scene.category || 'なし'}
- チェック項目: ${scene.checkItem}
- 根拠: ${scene.reason || 'なし'}
- AI用タグ: ${tagsText}
- 補足: ${scene.notes || 'なし'}

以下のJSON形式のみで回答してください（他のテキストは含めないでください）：
{
  "isAppropriate": true または false,
  "confidence": 0.0〜1.0の数値,
  "reason": "判定理由の詳細説明",
  "suggestions": ["改善提案1", "改善提案2"]
}

判定ポイント：
1. ${fileTypeText}が指定されたシーン（${scene.sceneType}${scene.subScene ? ' - ' + scene.subScene : ''}）の内容を正しく表しているか
2. チェック項目「${scene.checkItem}」を満たしているか
3. 不動産広告として適切な品質か${isPdf ? '（表示の正確性、法令遵守など）' : '（明るさ、構図、清潔感など）'}
4. 不適切な${isPdf ? '表記や誤解を招く表現' : '写り込み（個人情報、生活感のある物など）'}がないか
${tagsText !== 'なし' ? `5. AI用タグ（${tagsText}）に関連するオブジェクトが適切に表現されているか` : ''}
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
