# コーディング規約・スタイル

## インデント・フォーマット
- **タブ文字使用** (1タブ=4スペース相当)
- `.vscode/settings.json`で強制設定済み
- **例外**: yamlファイルは2スペース（タブ禁止のため）

## 言語別設定

### TypeScript (Frontend)
- **Strict mode**: `strict: true` 有効
- **型安全**: 完全型安全を実現
- **型定義**: 全型定義は `types/` ディレクトリに集約
- **Lint**: ESLint + TypeScript ESLint設定
- **コンパイル**: ES2022, React JSX

### JavaScript (Backend)  
- **Node.js**: CommonJS/ES Modules混在
- **型定義なし**: バックエンドはJavaScriptのみ
- **Lint**: ESLint基本設定

## ディレクトリ構造

### Frontend (React)
```
src/
├── components/    # 再利用コンポーネント
│   └── ui/       # 汎用UIコンポーネント
├── pages/        # ページコンポーネント
├── hooks/        # カスタムフック
├── contexts/     # React Context
├── lib/          # ユーティリティ・API
├── types/        # 型定義
├── router/       # ルーティング設定
└── styles/       # CSS・スタイル
```

### Backend (Express)
```
├── routes/       # API エンドポイント
├── services/     # ビジネスロジック
├── models/       # データモデル
├── middleware/   # Express ミドルウェア
├── workers/      # Bull Queue ワーカー
├── utils/        # ユーティリティ
├── tests/        # テストファイル
└── migrations/   # DB マイグレーション
```

## 命名規約

### ファイル名
- **React コンポーネント**: PascalCase (`UserProfile.tsx`)
- **ページ**: PascalCase + Page (`LoginPage.tsx`)
- **ユーティリティ**: camelCase (`apiClient.js`)
- **設定ファイル**: kebab-case (`eslint.config.js`)

### 変数・関数名
- **JavaScript/TypeScript**: camelCase
- **定数**: UPPER_SNAKE_CASE
- **React Hook**: `use` プレフィックス (`useAuth`)
- **API関数**: 動詞 + 名詞 (`getUserProfile`)

## コンポーネント設計

### React コンポーネント
```tsx
// 関数コンポーネント + TypeScript
interface Props {
  title: string;
  onSubmit: (data: FormData) => void;
}

export function MyComponent({ title, onSubmit }: Props) {
  // Hook使用
  const [state, setState] = useState<string>('');
  
  return (
    <div className="space-y-4">
      {/* Tailwind CSS使用 */}
    </div>
  );
}
```

### API設計
```javascript
// RESTful 構造
app.use('/api/auth', authRoutes);      // 認証
app.use('/api/agent', agentRoutes);    // ジョブ管理
app.use('/api/transcripts', routes);   // 議事録CRUD
app.use('/api/webhooks/zoom', routes); // Webhook
```

## セキュリティ実装

### パスワードハッシュ化
```javascript
const saltRounds = 12;
const hashedPassword = await bcrypt.hash(password, saltRounds);
```

### JWT設定
- **Access Token**: 24時間有効
- **署名**: HMAC SHA-256
- **Secret**: 32文字以上必須

### Express セキュリティ
```javascript
app.use(helmet());                // セキュリティヘッダー
app.use(cors(corsOptions));       // CORS設定
app.use(rateLimit(options));      // Rate limiting
app.use(express.json({ limit: '10mb' })); // ペイロード制限
```

## データベース設計原則

### 暗号化ルール
- **可逆性暗号化**: `bytea`型 + pgcrypto使用
- **適用対象**: API Secret, Webhook Secret等
- **非適用**: パスワード（ハッシュ化のみ）
- **実装**: `pgp_sym_encrypt(value, key)` / `pgp_sym_decrypt()`

### テーブル設計
- **正規化設計**: 第3正規形準拠
- **インデックス**: 全テーブル最適化済み
- **JSONB**: 柔軟メタデータ保存
- **制約**: 外部キー・CHECK制約活用

## コメント・ドキュメント

### 重要指針
- **CLAUDE.mdの指示**: コメントは原則追加しない
- **例外**: 複雑なビジネスロジック・セキュリティ関連のみ
- **JSDoc**: API関数のみ必要に応じて

## Import/Export パターン

### ES Modules (Frontend)
```typescript
// Named exports
export { Button } from './Button';
export type { ButtonProps } from './Button';

// Default exports (コンポーネント)
export default function LoginPage() {}
```

### CommonJS (Backend)  
```javascript
// Require
const express = require('express');
const { someFunction } = require('./utils');

// Module exports
module.exports = { router, middleware };
```