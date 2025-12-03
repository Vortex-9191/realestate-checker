/**
 * 不動産広告チェックリスト取得用 Google Apps Script
 *
 * 使い方:
 * 1. Google スプレッドシートを作成
 * 2. 拡張機能 > Apps Script でこのコードを貼り付け
 * 3. SPREADSHEET_ID を自分のスプレッドシートIDに変更
 * 4. デプロイ > 新しいデプロイ > ウェブアプリ
 * 5. アクセス権: 全員 を選択してデプロイ
 * 6. URLをコピーして .env.local の GAS_WEBAPP_URL に設定
 */

// スプレッドシートの構成:
// A列: ID
// B列: 種別 (売買（新築）, 売買（中古）, 賃貸（居住用）, 賃貸（事業用）, 共通)
// C列: カテゴリ
// D列: チェック項目
// E列: 根拠法令
// F列: 重要度 (high, medium, low)

const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';
const SHEET_NAME = 'チェックリスト';

function doGet(e) {
  try {
    const adType = e.parameter.type || '';

    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) {
      return createResponse({ error: 'Sheet not found' }, 404);
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // ヘッダーのインデックスを取得
    const idIndex = headers.indexOf('ID');
    const typeIndex = headers.indexOf('種別');
    const categoryIndex = headers.indexOf('カテゴリ');
    const checkItemIndex = headers.indexOf('チェック項目');
    const regulationIndex = headers.indexOf('根拠法令');
    const severityIndex = headers.indexOf('重要度');

    const checklist = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowType = row[typeIndex];

      // 指定された種別または「共通」の項目を取得
      if (adType === '' || rowType === adType || rowType === '共通') {
        checklist.push({
          id: row[idIndex] || `item_${i}`,
          category: row[categoryIndex] || '',
          checkItem: row[checkItemIndex] || '',
          regulation: row[regulationIndex] || '',
          severity: row[severityIndex] || 'medium'
        });
      }
    }

    return createResponse({ checklist: checklist });

  } catch (error) {
    return createResponse({ error: error.message }, 500);
  }
}

function createResponse(data, statusCode = 200) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

// テスト用関数
function testDoGet() {
  const mockEvent = {
    parameter: {
      type: '売買（新築）'
    }
  };

  const result = doGet(mockEvent);
  Logger.log(result.getContent());
}

// スプレッドシートのサンプルデータを作成
function createSampleData() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME)
    || SpreadsheetApp.openById(SPREADSHEET_ID).insertSheet(SHEET_NAME);

  // ヘッダー
  sheet.getRange(1, 1, 1, 6).setValues([
    ['ID', '種別', 'カテゴリ', 'チェック項目', '根拠法令', '重要度']
  ]);

  // サンプルデータ
  const sampleData = [
    ['001', '共通', '表示基準', '物件所在地の記載', '宅建業法第32条', 'high'],
    ['002', '共通', '表示基準', '価格の明確な表示', '不当景品類及び不当表示防止法', 'high'],
    ['003', '共通', '表示基準', '取引態様の明示', '宅建業法第34条', 'high'],
    ['004', '共通', '表示基準', '免許番号の記載', '宅建業法第50条', 'medium'],
    ['005', '売買（新築）', '重要事項', '建築確認番号の記載', '宅建業法第35条', 'high'],
    ['006', '売買（新築）', '重要事項', '完成予定時期の記載', '公正競争規約', 'medium'],
    ['007', '売買（中古）', '重要事項', '築年数の記載', '公正競争規約', 'high'],
    ['008', '売買（中古）', '重要事項', '建物構造の記載', '公正競争規約', 'medium'],
    ['009', '賃貸（居住用）', '賃貸条件', '賃料の記載', '宅建業法第35条', 'high'],
    ['010', '賃貸（居住用）', '賃貸条件', '敷金・礼金の記載', '公正競争規約', 'high'],
    ['011', '賃貸（事業用）', '賃貸条件', '契約形態の記載', '宅建業法第35条', 'high'],
    ['012', '共通', '禁止事項', '誇大広告の禁止', '宅建業法第32条', 'high'],
    ['013', '共通', '禁止事項', '虚偽表示の禁止', '不当景品類及び不当表示防止法', 'high'],
    ['014', '共通', '距離・時間', '最寄駅からの距離表示', '公正競争規約', 'medium'],
    ['015', '共通', '距離・時間', '徒歩所要時間の算出基準', '公正競争規約（80m=1分）', 'medium'],
  ];

  sheet.getRange(2, 1, sampleData.length, 6).setValues(sampleData);

  Logger.log('Sample data created!');
}
