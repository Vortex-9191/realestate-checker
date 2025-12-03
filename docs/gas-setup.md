# Google Apps Script (GAS) セットアップ手順

## 1. スプレッドシートの準備

スプレッドシートのシート1に以下の形式でデータを用意してください：

| A (シーン種別) | B (サブシーン) | C (案件名) | D (カテゴリ) | E (チェック項目) | F (根拠) | G (AI可否) | H (AI用タグ) | I (補足) |
|---------------|---------------|-----------|-------------|----------------|---------|-----------|-------------|---------|
| 外観 | 南側外観 | 共通 | 植栽 | 植栽が適切に配置されているか | 公正取引 | ○ | tree,plant,green | 季節に応じた表現 |
| バルコニー | バルコニー | 共通 | 手摺 | 手摺デザインが実際と一致 | 公正取引 | ○ | railing,balustrade | |

## 2. GASのスクリプト作成

1. スプレッドシートを開く
2. 「拡張機能」→「Apps Script」を選択
3. 以下のコードを貼り付けて保存

```javascript
function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  // CORSヘッダーを設定
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    const action = e.parameter.action || 'getScenes';
    const sceneType = e.parameter.sceneType || '';

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('シート1') || ss.getSheets()[0];
    const data = sheet.getDataRange().getValues();

    // ヘッダー行をスキップ
    const rows = data.slice(1);

    let result = [];

    if (action === 'getSceneTypes') {
      // シーン種別の一覧を取得
      const types = [...new Set(rows.map(row => row[0]).filter(t => t))];
      result = types;
    } else if (action === 'getScenes') {
      // シーン種別に基づいてチェックリストを取得
      rows.forEach((row, index) => {
        if (!sceneType || row[0] === sceneType) {
          result.push({
            id: (index + 2).toString(),
            sceneType: row[0] || '',
            subScene: row[1] || '',
            projectName: row[2] || '',
            category: row[3] || '',
            checkItem: row[4] || '',
            reason: row[5] || '',
            autoCheck: row[6] || '○',
            objectTags: row[7] ? row[7].split(',').map(t => t.trim()) : [],
            notes: row[8] || ''
          });
        }
      });
    }

    output.setContent(JSON.stringify({
      success: true,
      data: result
    }));
  } catch (error) {
    output.setContent(JSON.stringify({
      success: false,
      error: error.message
    }));
  }

  return output;
}
```

## 3. ウェブアプリとしてデプロイ

1. 「デプロイ」→「新しいデプロイ」を選択
2. 「種類の選択」で「ウェブアプリ」を選択
3. 設定：
   - 説明: 不動産チェッカー用API
   - ウェブアプリ実行者: 自分
   - アクセスできるユーザー: **全員**
4. 「デプロイ」をクリック
5. 表示されたウェブアプリのURLをコピー

## 4. 環境変数に設定

`.env.local`に以下を追加：

```
NEXT_PUBLIC_GAS_URL=https://script.google.com/macros/s/xxxxx/exec
```

## API使用例

### シーン種別一覧取得
```
GET https://script.google.com/macros/s/xxxxx/exec?action=getSceneTypes
```

### 特定シーン種別のチェックリスト取得
```
GET https://script.google.com/macros/s/xxxxx/exec?action=getScenes&sceneType=外観
```

### 全チェックリスト取得
```
GET https://script.google.com/macros/s/xxxxx/exec?action=getScenes
```
