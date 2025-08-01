-- メール配信設定機能追加
-- 作成日時: 2025年7月10日

-- usersテーブルにメール配信設定カラムを追加
ALTER TABLE users ADD COLUMN email_distribution_preference VARCHAR(20) DEFAULT 'host_only';
-- 'host_only': ホストのみに配信
-- 'all_participants': 全参加者に配信（Bcc）

-- メール配信設定のコメント追加
COMMENT ON COLUMN users.email_distribution_preference IS 'メール配信設定: host_only=ホストのみ, all_participants=全参加者（Bcc）';

-- 既存ユーザーのデフォルト設定を確認・設定
UPDATE users SET email_distribution_preference = 'host_only' WHERE email_distribution_preference IS NULL;