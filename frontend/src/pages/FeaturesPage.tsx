import { Link } from 'react-router-dom';
import { ArrowLeft, Zap, Brain, Mail, Shield, Users, Clock, CheckCircle, Star, Workflow, MessageSquare } from 'lucide-react';

const FeaturesPage = () => {
	return (
		<div className="features-page">
			{/* Header */}
			<header className="features-header">
				<div className="features-header-content">
					<Link to="/" className="features-back-btn">
						<ArrowLeft size={20} />
						ダッシュボードに戻る
					</Link>
					<div className="features-title-section">
						<h1 className="features-main-title">
							AI議事録自動配布システム
						</h1>
						<p className="features-subtitle">
							Zoom会議を自動で議事録化し、関係者に即座に配布する次世代AIシステム
						</p>
					</div>
				</div>
			</header>

			{/* Main Content */}
			<main className="features-main">
				{/* 概要セクション */}
				<section className="features-overview">
					<div className="features-overview-content">
						<h2 className="features-section-title">システム概要</h2>
						<p className="features-description">
							本システムは、Zoom会議の終了と同時に自動的に議事録を生成・配布する革新的なAIソリューションです。
							会議参加者の時間を節約し、情報共有の効率化を実現します。
						</p>
						
						<div className="features-stats">
							<div className="features-stat">
								<div className="features-stat-number">98%</div>
								<div className="features-stat-label">VTT処理成功率</div>
							</div>
							<div className="features-stat">
								<div className="features-stat-number">3分</div>
								<div className="features-stat-label">平均処理時間</div>
							</div>
							<div className="features-stat">
								<div className="features-stat-number">90%</div>
								<div className="features-stat-label">コスト削減効果</div>
							</div>
						</div>
					</div>
				</section>

				{/* 主要機能セクション */}
				<section className="features-main-features">
					<h2 className="features-section-title">主要機能</h2>
					<div className="features-grid">
						<div className="feature-card">
							<div className="feature-icon blue">
								<Zap size={24} />
							</div>
							<h3 className="feature-title">リアルタイム自動検知</h3>
							<p className="feature-description">
								Zoom Webhook連携により、会議終了と同時に自動処理を開始。
								手動操作は一切不要です。
							</p>
							<ul className="feature-details">
								<li>Zoom API連携による即座の検知</li>
								<li>HMAC-SHA256署名検証による安全性</li>
								<li>マルチテナント対応</li>
							</ul>
						</div>

						<div className="feature-card">
							<div className="feature-icon green">
								<Brain size={24} />
							</div>
							<h3 className="feature-title">高精度AI議事録生成</h3>
							<p className="feature-description">
								OpenAI Whisper + Anthropic Claude APIによる2段階処理で、
								高品質な議事録を自動生成します。
							</p>
							<ul className="feature-details">
								<li>VTT優先処理による高成功率</li>
								<li>専門用語の自動学習・保持</li>
								<li>要約・アクションアイテム抽出</li>
							</ul>
						</div>

						<div className="feature-card">
							<div className="feature-icon purple">
								<Mail size={24} />
							</div>
							<h3 className="feature-title">多様な配布方法</h3>
							<p className="feature-description">
								メール、Slack、ワークフローAPIなど、
								組織のニーズに合わせた配布方法をサポート。
							</p>
							<ul className="feature-details">
								<li>メール自動配信（HTML形式）</li>
								<li>Slack通知連携</li>
								<li>カスタムワークフローAPI対応</li>
							</ul>
						</div>

						<div className="feature-card">
							<div className="feature-icon orange">
								<Users size={24} />
							</div>
							<h3 className="feature-title">マルチテナント対応</h3>
							<p className="feature-description">
								複数企業・部門での同時利用が可能。
								データ分離とセキュリティを完全保証します。
							</p>
							<ul className="feature-details">
								<li>完全なデータ分離</li>
								<li>テナント別権限管理</li>
								<li>独立したZoom設定</li>
							</ul>
						</div>

						<div className="feature-card">
							<div className="feature-icon red">
								<Shield size={24} />
							</div>
							<h3 className="feature-title">エンタープライズセキュリティ</h3>
							<p className="feature-description">
								JWT認証、ロールベース権限管理、
								暗号化通信により企業レベルのセキュリティを実現。
							</p>
							<ul className="feature-details">
								<li>JWT + NextAuth.js認証</li>
								<li>PostgreSQL bytea暗号化</li>
								<li>HTTPS/TLS通信</li>
							</ul>
						</div>

						<div className="feature-card">
							<div className="feature-icon indigo">
								<Clock size={24} />
							</div>
							<h3 className="feature-title">高速処理</h3>
							<p className="feature-description">
								Redis Queue + Bull Queueによる並列処理で、
								大量の会議も効率的に処理します。
							</p>
							<ul className="feature-details">
								<li>バックグラウンド並列処理</li>
								<li>キューシステムによる負荷分散</li>
								<li>フォールバック機能による堅牢性</li>
							</ul>
						</div>
					</div>
				</section>

				{/* 技術仕様セクション */}
				<section className="features-tech-specs">
					<h2 className="features-section-title">技術仕様</h2>
					<div className="tech-specs-grid">
						<div className="tech-spec-category">
							<h3 className="tech-spec-title">フロントエンド</h3>
							<ul className="tech-spec-list">
								<li>Next.js 15 App Router</li>
								<li>TypeScript</li>
								<li>Tailwind CSS</li>
								<li>NextAuth.js</li>
								<li>React Query</li>
							</ul>
						</div>
						<div className="tech-spec-category">
							<h3 className="tech-spec-title">バックエンド</h3>
							<ul className="tech-spec-list">
								<li>Node.js + Express.js</li>
								<li>PostgreSQL 15</li>
								<li>Redis 7</li>
								<li>JWT認証</li>
								<li>Bull Queue</li>
							</ul>
						</div>
						<div className="tech-spec-category">
							<h3 className="tech-spec-title">AI・外部連携</h3>
							<ul className="tech-spec-list">
								<li>OpenAI Whisper API</li>
								<li>Anthropic Claude API</li>
								<li>Zoom API</li>
								<li>Nodemailer</li>
								<li>Slack API</li>
							</ul>
						</div>
					</div>
				</section>

				{/* 処理フローセクション */}
				<section className="features-workflow">
					<h2 className="features-section-title">処理フロー</h2>
					<div className="workflow-steps">
						<div className="workflow-step">
							<div className="workflow-step-number">1</div>
							<div className="workflow-step-content">
								<h4 className="workflow-step-title">会議終了検知</h4>
								<p className="workflow-step-description">
									Zoom Webhookが会議終了を自動検知し、システムが処理を開始
								</p>
							</div>
						</div>
						<div className="workflow-step">
							<div className="workflow-step-number">2</div>
							<div className="workflow-step-content">
								<h4 className="workflow-step-title">録画・VTTファイル取得</h4>
								<p className="workflow-step-description">
									VTT優先処理により高成功率でファイルを取得、フォールバック機能完備
								</p>
							</div>
						</div>
						<div className="workflow-step">
							<div className="workflow-step-number">3</div>
							<div className="workflow-step-content">
								<h4 className="workflow-step-title">AI議事録生成</h4>
								<p className="workflow-step-description">
									Whisper文字起こし + Claude整形により高品質な議事録を生成
								</p>
							</div>
						</div>
						<div className="workflow-step">
							<div className="workflow-step-number">4</div>
							<div className="workflow-step-content">
								<h4 className="workflow-step-title">自動配布</h4>
								<p className="workflow-step-description">
									メール・Slack・ワークフローAPIを通じて関係者に即座に配布
								</p>
							</div>
						</div>
					</div>
				</section>

				{/* 利点セクション */}
				<section className="features-benefits">
					<h2 className="features-section-title">導入効果</h2>
					<div className="benefits-grid">
						<div className="benefit-item">
							<CheckCircle className="benefit-icon" size={24} />
							<h4 className="benefit-title">作業効率の大幅向上</h4>
							<p className="benefit-description">
								手動での議事録作成が不要になり、参加者は本来の業務に集中可能
							</p>
						</div>
						<div className="benefit-item">
							<Star className="benefit-icon" size={24} />
							<h4 className="benefit-title">品質の標準化</h4>
							<p className="benefit-description">
								AIによる一定品質の議事録生成で、情報共有の品質を標準化
							</p>
						</div>
						<div className="benefit-item">
							<Workflow className="benefit-icon" size={24} />
							<h4 className="benefit-title">業務フロー改善</h4>
							<p className="benefit-description">
								即座の配布により意思決定の迅速化と業務フロー改善を実現
							</p>
						</div>
						<div className="benefit-item">
							<MessageSquare className="benefit-icon" size={24} />
							<h4 className="benefit-title">情報共有の促進</h4>
							<p className="benefit-description">
								欠席者や関係者への確実な情報共有で組織全体の連携を強化
							</p>
						</div>
					</div>
				</section>

				{/* 対応企業規模セクション */}
				<section className="features-scale">
					<h2 className="features-section-title">対応企業規模</h2>
					<div className="scale-cards">
						<div className="scale-card">
							<h3 className="scale-title">スタートアップ</h3>
							<div className="scale-users">〜50名</div>
							<ul className="scale-features">
								<li>シンプルな導入</li>
								<li>コスト効率重視</li>
								<li>基本機能フル活用</li>
							</ul>
						</div>
						<div className="scale-card featured">
							<h3 className="scale-title">中小企業</h3>
							<div className="scale-users">50〜500名</div>
							<ul className="scale-features">
								<li>マルチテナント活用</li>
								<li>部門別権限管理</li>
								<li>カスタム配布設定</li>
							</ul>
						</div>
						<div className="scale-card">
							<h3 className="scale-title">大企業</h3>
							<div className="scale-users">500名〜</div>
							<ul className="scale-features">
								<li>エンタープライズセキュリティ</li>
								<li>大規模並列処理</li>
								<li>既存システム連携</li>
							</ul>
						</div>
					</div>
				</section>

				{/* CTAセクション */}
				<section className="features-cta">
					<div className="cta-content">
						<h2 className="cta-title">今すぐ始めませんか？</h2>
						<p className="cta-description">
							AI議事録自動配布システムで、会議の生産性を革新しましょう
						</p>
						<div className="cta-buttons">
							<Link to="/register" className="cta-btn primary">
								無料トライアル開始
							</Link>
							<Link to="/contact" className="cta-btn secondary">
								お問い合わせ
							</Link>
						</div>
					</div>
				</section>
			</main>
		</div>
	);
};

export default FeaturesPage;