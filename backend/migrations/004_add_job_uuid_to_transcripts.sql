-- meeting_transcriptsテーブルにjob_uuidカラムを追加
-- 議事録とエージェントジョブの関連付けを有効にする

DO $$
BEGIN
    -- job_uuidカラムが存在しない場合のみ追加
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'meeting_transcripts' 
        AND column_name = 'job_uuid'
    ) THEN
        ALTER TABLE meeting_transcripts 
        ADD COLUMN job_uuid UUID;
        
        -- 外部キー制約追加
        ALTER TABLE meeting_transcripts 
        ADD CONSTRAINT meeting_transcripts_job_uuid_fkey 
        FOREIGN KEY (job_uuid) REFERENCES agent_jobs(job_uuid);
        
        -- インデックス追加（検索最適化）
        CREATE INDEX idx_meeting_transcripts_job_uuid 
        ON meeting_transcripts(job_uuid);
        
        RAISE NOTICE 'job_uuidカラムをmeeting_transcriptsテーブルに追加しました';
    ELSE
        RAISE NOTICE 'job_uuidカラムは既に存在します';
    END IF;
END $$;

-- 他のカラム名の統一
DO $$
BEGIN
    -- zoom_meeting_idカラムの名前を確認・統一
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'meeting_transcripts' 
        AND column_name = 'meeting_id'
    ) AND NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'meeting_transcripts' 
        AND column_name = 'zoom_meeting_id'
    ) THEN
        ALTER TABLE meeting_transcripts 
        RENAME COLUMN meeting_id TO zoom_meeting_id;
        
        RAISE NOTICE 'meeting_idをzoom_meeting_idにリネームしました';
    END IF;

    -- meeting_topicカラムの追加（titleカラムの別名）
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'meeting_transcripts' 
        AND column_name = 'title'
    ) AND NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'meeting_transcripts' 
        AND column_name = 'meeting_topic'
    ) THEN
        ALTER TABLE meeting_transcripts 
        RENAME COLUMN title TO meeting_topic;
        
        RAISE NOTICE 'titleをmeeting_topicにリネームしました';
    END IF;

    -- start_timeカラムの追加
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'meeting_transcripts' 
        AND column_name = 'meeting_start_time'
    ) AND NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'meeting_transcripts' 
        AND column_name = 'start_time'
    ) THEN
        ALTER TABLE meeting_transcripts 
        RENAME COLUMN meeting_start_time TO start_time;
        
        RAISE NOTICE 'meeting_start_timeをstart_timeにリネームしました';
    END IF;

    -- durationカラムの追加
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'meeting_transcripts' 
        AND column_name = 'duration'
    ) THEN
        ALTER TABLE meeting_transcripts 
        ADD COLUMN duration INTEGER; -- 分単位での会議時間
        
        RAISE NOTICE 'durationカラムを追加しました';
    END IF;
END $$;