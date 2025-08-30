const express = require('express');
const { query } = require('../utils/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// フォーマットテンプレート一覧取得（テナント単位）
router.get('/', authenticateToken, async (req, res) => {
	try {
		const result = await query(`
			SELECT 
				template_uuid,
				template_name,
				template_description,
				format_structure,
				is_default,
				is_active,
				created_at,
				updated_at
			FROM transcript_format_templates
			WHERE tenant_id = $1 AND is_active = true
			ORDER BY is_default DESC, created_at DESC
		`, [req.user.tenant_id]);

		res.json({
			templates: result.rows
		});

	} catch (error) {
		console.error('フォーマットテンプレート取得エラー:', error);
		res.status(500).json({
			error: 'フォーマットテンプレート取得中にエラーが発生しました'
		});
	}
});

// 特定のフォーマットテンプレート取得
router.get('/:templateUuid', authenticateToken, async (req, res) => {
	try {
		const result = await query(`
			SELECT 
				template_uuid,
				template_name,
				template_description,
				format_structure,
				is_default,
				is_active,
				created_at,
				updated_at
			FROM transcript_format_templates
			WHERE template_uuid = $1 AND tenant_id = $2 AND is_active = true
		`, [req.params.templateUuid, req.user.tenant_id]);

		if (result.rows.length === 0) {
			return res.status(404).json({
				error: 'フォーマットテンプレートが見つかりません'
			});
		}

		res.json({
			template: result.rows[0]
		});

	} catch (error) {
		console.error('フォーマットテンプレート詳細取得エラー:', error);
		res.status(500).json({
			error: 'フォーマットテンプレート詳細取得中にエラーが発生しました'
		});
	}
});

// フォーマットテンプレート作成（テナント管理者のみ）
router.post('/', [
	authenticateToken,
	requireRole(['tenant_admin', 'admin']),
	body('template_name').notEmpty().withMessage('テンプレート名は必須です'),
	body('format_structure').isObject().withMessage('フォーマット構造は必須です'),
	body('template_description').optional().isString()
], async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				error: 'バリデーションエラー',
				details: errors.array()
			});
		}

		const { template_name, template_description, format_structure, is_default } = req.body;

		// is_defaultがtrueの場合、既存のデフォルトテンプレートを無効化
		if (is_default) {
			await query(`
				UPDATE transcript_format_templates
				SET is_default = false, updated_at = CURRENT_TIMESTAMP
				WHERE tenant_id = $1 AND is_default = true
			`, [req.user.tenant_id]);
		}

		const result = await query(`
			INSERT INTO transcript_format_templates (
				tenant_id,
				template_name,
				template_description,
				format_structure,
				is_default,
				is_active
			) VALUES ($1, $2, $3, $4, $5, true)
			RETURNING template_uuid, template_name, created_at
		`, [
			req.user.tenant_id,
			template_name,
			template_description || '',
			JSON.stringify(format_structure),
			is_default || false
		]);

		console.log(`フォーマットテンプレート作成: ${template_name} (テナント: ${req.user.tenant_id}, 作成者: ${req.user.email})`);

		res.status(201).json({
			message: 'フォーマットテンプレートが作成されました',
			template: result.rows[0]
		});

	} catch (error) {
		console.error('フォーマットテンプレート作成エラー:', error);
		res.status(500).json({
			error: 'フォーマットテンプレート作成中にエラーが発生しました'
		});
	}
});

// フォーマットテンプレート更新（テナント管理者のみ）
router.put('/:templateUuid', [
	authenticateToken,
	requireRole(['tenant_admin', 'admin']),
	body('template_name').optional().isString(),
	body('format_structure').optional().isObject(),
	body('template_description').optional().isString()
], async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				error: 'バリデーションエラー',
				details: errors.array()
			});
		}

		const { template_name, template_description, format_structure, is_default } = req.body;

		// 更新対象のテンプレートが存在するかチェック
		const checkResult = await query(`
			SELECT template_uuid FROM transcript_format_templates
			WHERE template_uuid = $1 AND tenant_id = $2 AND is_active = true
		`, [req.params.templateUuid, req.user.tenant_id]);

		if (checkResult.rows.length === 0) {
			return res.status(404).json({
				error: 'フォーマットテンプレートが見つかりません'
			});
		}

		// is_defaultがtrueの場合、他のデフォルトテンプレートを無効化
		if (is_default) {
			await query(`
				UPDATE transcript_format_templates
				SET is_default = false, updated_at = CURRENT_TIMESTAMP
				WHERE tenant_id = $1 AND is_default = true AND template_uuid != $2
			`, [req.user.tenant_id, req.params.templateUuid]);
		}

		// 動的に更新フィールドを構築
		const updateFields = [];
		const params = [];
		let paramIndex = 1;

		if (template_name !== undefined) {
			updateFields.push(`template_name = $${paramIndex}`);
			params.push(template_name);
			paramIndex++;
		}

		if (template_description !== undefined) {
			updateFields.push(`template_description = $${paramIndex}`);
			params.push(template_description);
			paramIndex++;
		}

		if (format_structure !== undefined) {
			updateFields.push(`format_structure = $${paramIndex}`);
			params.push(JSON.stringify(format_structure));
			paramIndex++;
		}

		if (is_default !== undefined) {
			updateFields.push(`is_default = $${paramIndex}`);
			params.push(is_default);
			paramIndex++;
		}

		if (updateFields.length === 0) {
			return res.status(400).json({
				error: '更新する項目がありません'
			});
		}

		updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
		params.push(req.params.templateUuid);
		params.push(req.user.tenant_id);

		const result = await query(`
			UPDATE transcript_format_templates
			SET ${updateFields.join(', ')}
			WHERE template_uuid = $${paramIndex} AND tenant_id = $${paramIndex + 1}
			RETURNING template_uuid, template_name, updated_at
		`, params);

		console.log(`フォーマットテンプレート更新: ${req.params.templateUuid} (テナント: ${req.user.tenant_id}, 更新者: ${req.user.email})`);

		res.json({
			message: 'フォーマットテンプレートが更新されました',
			template: result.rows[0]
		});

	} catch (error) {
		console.error('フォーマットテンプレート更新エラー:', error);
		res.status(500).json({
			error: 'フォーマットテンプレート更新中にエラーが発生しました'
		});
	}
});

// フォーマットテンプレート削除（テナント管理者のみ）
router.delete('/:templateUuid', [authenticateToken, requireRole(['tenant_admin', 'admin'])], async (req, res) => {
	try {
		// デフォルトテンプレートの削除を防止
		const checkResult = await query(`
			SELECT template_uuid, is_default FROM transcript_format_templates
			WHERE template_uuid = $1 AND tenant_id = $2 AND is_active = true
		`, [req.params.templateUuid, req.user.tenant_id]);

		if (checkResult.rows.length === 0) {
			return res.status(404).json({
				error: 'フォーマットテンプレートが見つかりません'
			});
		}

		if (checkResult.rows[0].is_default) {
			return res.status(400).json({
				error: 'デフォルトテンプレートは削除できません'
			});
		}

		// ソフトデリート（is_active = false）
		await query(`
			UPDATE transcript_format_templates
			SET is_active = false, updated_at = CURRENT_TIMESTAMP
			WHERE template_uuid = $1 AND tenant_id = $2
		`, [req.params.templateUuid, req.user.tenant_id]);

		console.log(`フォーマットテンプレート削除: ${req.params.templateUuid} (テナント: ${req.user.tenant_id}, 削除者: ${req.user.email})`);

		res.json({
			message: 'フォーマットテンプレートが削除されました'
		});

	} catch (error) {
		console.error('フォーマットテンプレート削除エラー:', error);
		res.status(500).json({
			error: 'フォーマットテンプレート削除中にエラーが発生しました'
		});
	}
});

// プレビュー生成（サンプルデータでプレビュー）
router.post('/preview', [
	authenticateToken,
	body('format_structure').isObject().withMessage('フォーマット構造は必須です')
], async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				error: 'バリデーションエラー',
				details: errors.array()
			});
		}

		const { format_structure } = req.body;

		// サンプルデータ
		const sampleData = {
			meeting_topic: 'サンプル会議',
			start_time: new Date().toISOString(),
			duration: 60,
			participants: ['田中太郎', '佐藤花子', '山田次郎'],
			summary: 'プロジェクトの進捗について議論しました。次回までにタスクAとBを完了予定です。',
			formatted_transcript: `# サンプル会議議事録

## 開始
田中太郎: 本日はお忙しい中、お時間をいただきありがとうございます。

## 進捗報告
佐藤花子: タスクAについては80%完了しています。予定通り今週末には終了予定です。

## 課題と対策
山田次郎: 技術的な課題がいくつかありますが、解決策を検討中です。`,
			action_items: ['タスクA完了 (佐藤)', 'タスクB開始 (山田)', '次回会議設定 (田中)']
		};

		// フォーマット構造に基づいてプレビューを生成
		const previewHtml = generatePreviewFromStructure(format_structure, sampleData);

		res.json({
			preview_html: previewHtml,
			sample_data: sampleData
		});

	} catch (error) {
		console.error('プレビュー生成エラー:', error);
		res.status(500).json({
			error: 'プレビュー生成中にエラーが発生しました'
		});
	}
});

// フォーマット構造からプレビューHTMLを生成
function generatePreviewFromStructure(structure, data) {
	if (!structure.sections || !Array.isArray(structure.sections)) {
		return '<p>無効なフォーマット構造です</p>';
	}

	// セクションを順序でソート
	const sortedSections = structure.sections.sort((a, b) => (a.order || 0) - (b.order || 0));
	
	let html = '<div class="preview-content">';

	sortedSections.forEach(section => {
		html += `<div class="section section-${section.type}">`;
		
		if (section.title) {
			html += `<h2 class="section-title">${section.title}</h2>`;
		}

		// セクションタイプに応じて内容を生成
		switch (section.type) {
			case 'header':
				html += generateHeaderSection(section, data);
				break;
			case 'summary':
				html += generateSummarySection(section, data);
				break;
			case 'content':
				html += generateContentSection(section, data);
				break;
			case 'action_items':
				html += generateActionItemsSection(section, data);
				break;
			default:
				html += generateCustomSection(section, data);
		}

		html += '</div>';
	});

	html += '</div>';
	return html;
}

function generateHeaderSection(section, data) {
	let html = '<div class="header-info">';
	
	if (section.fields?.includes('meeting_topic')) {
		html += `<p><strong>会議名:</strong> ${data.meeting_topic || '未設定'}</p>`;
	}
	
	if (section.fields?.includes('start_time')) {
		const formatDate = new Date(data.start_time).toLocaleDateString('ja-JP', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
		html += `<p><strong>開始時刻:</strong> ${formatDate}</p>`;
	}
	
	if (section.fields?.includes('duration')) {
		html += `<p><strong>所要時間:</strong> ${data.duration || 0}分</p>`;
	}
	
	if (section.fields?.includes('participants')) {
		html += `<p><strong>参加者:</strong> ${(data.participants || []).join('、')}</p>`;
	}
	
	html += '</div>';
	return html;
}

function generateSummarySection(section, data) {
	return `<div class="summary-content">
		<p>${data.summary || '要約がありません'}</p>
	</div>`;
}

function generateContentSection(section, data) {
	// Markdownを簡易HTMLに変換
	let content = data.formatted_transcript || '議事録内容がありません';
	
	// 簡易Markdown→HTML変換
	content = content
		.replace(/^# (.*$)/gm, '<h1>$1</h1>')
		.replace(/^## (.*$)/gm, '<h2>$1</h2>')
		.replace(/^### (.*$)/gm, '<h3>$1</h3>')
		.replace(/\n\n/g, '</p><p>')
		.replace(/^\s*(.+)/gm, '<p>$1</p>');

	return `<div class="transcript-content">${content}</div>`;
}

function generateActionItemsSection(section, data) {
	const items = data.action_items || [];
	
	if (items.length === 0) {
		return '<p>アクションアイテムがありません</p>';
	}

	let html = '<ul class="action-items-list">';
	items.forEach(item => {
		html += `<li>${item}</li>`;
	});
	html += '</ul>';
	
	return html;
}

function generateCustomSection(section, data) {
	return `<div class="custom-section">
		<p>カスタムセクション: ${section.type}</p>
	</div>`;
}

module.exports = router;