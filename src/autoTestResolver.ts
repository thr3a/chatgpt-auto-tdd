import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import OpenAI from 'openai';
import { startVitest } from 'vitest/node';

const model = 'gpt-4o';

interface VitestResult {
  numTotalTestSuites: number;
  numPassedTestSuites: number;
  numFailedTestSuites: number;
  testResults: Array<{
    name: string;
    status: string;
    message?: string;
  }>;
}

async function runVitest(testPath: string): Promise<VitestResult> {
  const jsonPath = 'test-results.json';
  const vitest = await startVitest('test', [testPath], {
    watch: false,
    run: true,
    reporters: ['json'],
    outputFile: jsonPath
  });

  if (!vitest) {
    throw new Error('Vitestの初期化に失敗しました');
  }

  await vitest.close();
  const json = await readFile(jsonPath, 'utf-8');
  return JSON.parse(json);
}

async function fetchGPTSolution(sourceCode: string, testCode: string, testResults: string): Promise<string> {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  const prompt = `
以下のTypeScriptコードを修正し、テストコードがすべて通るようにしてください。
テストコードsrc/hoge.test.tsは修正しないでください。
修正後のsrc/hoge.tsのコードだけを\`\`\`typescriptで囲んで出力してください。

# Steps
1. 提供された実装コードを確認し、構文やロジックの誤りを特定する。
2. テストコードを読み、実装コードが満たすべき条件や期待される動作を理解する。
3. テスト結果を分析し、どの部分で失敗しているかを確認する。
4. 特定した誤りを修正し、テストが全て通るように実装コードを改変する。
5. 修正後の実装コードを出力する。

【実装コード】
\`\`\`typescript
${sourceCode}
\`\`\`

【テストコード】
\`\`\`typescript
${testCode}
\`\`\`

【テスト結果】
\`\`\`json
${testResults}
\`\`\`
`;

  const chatCompletion = await client.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: model
  });

  const content = chatCompletion.choices[0].message?.content || '';

  // ChatGPTのレスポンスからコードブロックを抽出
  const codeMatch = content.match(/```typescript([\s\S]*?)```/);
  const newCode = codeMatch ? codeMatch[1].trim() : '';

  return newCode;
}

async function main(sourcePath: string, testPath: string) {
  while (true) {
    const sourceCode = await readFile(sourcePath, 'utf-8');
    const testCode = await readFile(testPath, 'utf-8');

    const testResults = await runVitest(testPath);

    // 全てのテストが成功していれば終了
    if (testResults.numFailedTestSuites === 0) {
      console.log('全てのテストが成功しました！');
      break;
    }

    // ChatGPTに解決策を求める
    const solution = await fetchGPTSolution(sourceCode, testCode, JSON.stringify(testResults, null, 2));

    // 解決策をファイルに書き込む
    await writeFile(sourcePath, solution, 'utf-8');

    console.log('実装を更新しました。再度テストを実行します...');
  }
}

// コマンドライン引数からファイルパスを取得
const sourcePath = process.argv[2];
const testPath = process.argv[3];

if (!sourcePath || !testPath) {
  console.error('使用方法: ts-node script.ts <sourcePath> <testPath>');
  process.exit(1);
}

if (!existsSync(sourcePath) || !existsSync(testPath)) {
  console.error('コードファイルまたはテストファイルが存在しません');
  process.exit(1);
}

main(sourcePath, testPath).catch(console.error);
