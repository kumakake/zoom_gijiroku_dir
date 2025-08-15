import { Link } from 'react-router-dom';
import { Play, ArrowRight, CheckCircle, Star, Users, Clock, Shield, Zap, Brain, TrendingUp, Download, MessageSquare } from 'lucide-react';
import { useState } from 'react';

const LandingPage = () => {
	const [email, setEmail] = useState('');

	const handleEmailSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		// メール登録処理（実装は後で）
		alert('ありがとうございます！お問い合わせフォームに移動します。');
	};

	return (
		<div className="landing-page">
			{/* Hero Section */}
			<section className="hero">
				<div className="hero-background">
					<div className="hero-gradient"></div>
				</div>
				<div className="hero-content">
					<div className="hero-badge">
						<span className="hero-badge-text">🚀 革新的なAI議事録システム</span>
					</div>
					<h1 className="hero-title">
						Zoom会議が終わった瞬間に<br />
						<span className="hero-highlight">完璧な議事録</span>が届く
					</h1>
					<p className="hero-subtitle">
						手動での議事録作成はもう不要。AIが自動で高品質な議事録を生成し、
						関係者全員に即座に配布する次世代システム
					</p>
					<div className="hero-stats">
						<div className="hero-stat">
							<div className="hero-stat-number">98%</div>
							<div className="hero-stat-label">処理成功率</div>
						</div>
						<div className="hero-stat">
							<div className="hero-stat-number">3分</div>
							<div className="hero-stat-label">平均処理時間</div>
						</div>
						<div className="hero-stat">
							<div className="hero-stat-number">90%</div>
							<div className="hero-stat-label">工数削減</div>
						</div>
					</div>
					<div className="hero-cta">
						<Link to="/register" className="hero-btn primary">
							<Play size={20} />
							無料で始める
						</Link>
						<Link to="/features" className="hero-btn secondary">
							詳しく見る
							<ArrowRight size={20} />
						</Link>
					</div>
				</div>
			</section>

			{/* Problem Section */}
			<section className="problem">
				<div className="problem-content">
					<h2 className="problem-title">
						まだ議事録作成に<span className="problem-highlight">時間を浪費</span>していませんか？
					</h2>
					<div className="problem-grid">
						<div className="problem-item">
							<div className="problem-icon">😓</div>
							<h3 className="problem-item-title">会議後の作業負担</h3>
							<p className="problem-item-desc">
								1時間の会議の後に、さらに30分〜1時間かけて議事録を作成
							</p>
						</div>
						<div className="problem-item">
							<div className="problem-icon">⏰</div>
							<h3 className="problem-item-title">情報共有の遅れ</h3>
							<p className="problem-item-desc">
								議事録の作成・共有が遅れ、次のアクションが停滞
							</p>
						</div>
						<div className="problem-item">
							<div className="problem-icon">❌</div>
							<h3 className="problem-item-title">内容の不正確性</h3>
							<p className="problem-item-desc">
								メモ漏れや記憶違いによる重要情報の欠落
							</p>
						</div>
						<div className="problem-item">
							<div className="problem-icon">📈</div>
							<h3 className="problem-item-title">スケーラビリティの限界</h3>
							<p className="problem-item-desc">
								会議数の増加に比例して工数が増大し、業務を圧迫
							</p>
						</div>
					</div>
				</div>
			</section>

			{/* Solution Section */}
			<section className="solution">
				<div className="solution-content">
					<div className="solution-header">
						<h2 className="solution-title">
							<span className="solution-highlight">AI議事録自動配布システム</span>が<br />
							すべての課題を解決
						</h2>
						<p className="solution-subtitle">
							Zoom会議の終了と同時に、AIが自動で議事録を生成・配布。
							手動作業ゼロで、完璧な情報共有を実現します。
						</p>
					</div>
					<div className="solution-features">
						<div className="solution-feature">
							<div className="solution-feature-icon blue">
								<Zap size={32} />
							</div>
							<h3 className="solution-feature-title">完全自動化</h3>
							<p className="solution-feature-desc">
								会議終了の瞬間から配布まで、一切の手動操作なし
							</p>
						</div>
						<div className="solution-feature">
							<div className="solution-feature-icon green">
								<Brain size={32} />
							</div>
							<h3 className="solution-feature-title">高精度AI処理</h3>
							<p className="solution-feature-desc">
								Whisper + Claude APIによる人間レベルの議事録品質
							</p>
						</div>
						<div className="solution-feature">
							<div className="solution-feature-icon purple">
								<Clock size={32} />
							</div>
							<h3 className="solution-feature-title">超高速処理</h3>
							<p className="solution-feature-desc">
								平均3分で完成、即座にメール・Slack配信
							</p>
						</div>
						<div className="solution-feature">
							<div className="solution-feature-icon orange">
								<Shield size={32} />
							</div>
							<h3 className="solution-feature-title">企業レベルセキュリティ</h3>
							<p className="solution-feature-desc">
								エンドツーエンド暗号化、マルチテナント対応
							</p>
						</div>
					</div>
				</div>
			</section>

			{/* Demo Section */}
			<section className="demo">
				<div className="demo-content">
					<h2 className="demo-title">
						実際の処理フローを見てみましょう
					</h2>
					<div className="demo-steps">
						<div className="demo-step">
							<div className="demo-step-number">1</div>
							<div className="demo-step-content">
								<h4 className="demo-step-title">Zoom会議終了</h4>
								<p className="demo-step-desc">通常通り会議を終了するだけ</p>
							</div>
						</div>
						<div className="demo-arrow">→</div>
						<div className="demo-step">
							<div className="demo-step-number">2</div>
							<div className="demo-step-content">
								<h4 className="demo-step-title">AI自動処理</h4>
								<p className="demo-step-desc">録画データを自動取得・解析</p>
							</div>
						</div>
						<div className="demo-arrow">→</div>
						<div className="demo-step">
							<div className="demo-step-number">3</div>
							<div className="demo-step-content">
								<h4 className="demo-step-title">議事録生成</h4>
								<p className="demo-step-desc">高品質な議事録を3分で生成</p>
							</div>
						</div>
						<div className="demo-arrow">→</div>
						<div className="demo-step">
							<div className="demo-step-number">4</div>
							<div className="demo-step-content">
								<h4 className="demo-step-title">自動配布</h4>
								<p className="demo-step-desc">関係者全員に即座に配信</p>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Benefits Section */}
			<section className="benefits">
				<div className="benefits-content">
					<h2 className="benefits-title">
						導入企業が実感している<span className="benefits-highlight">驚きの効果</span>
					</h2>
					<div className="benefits-grid">
						<div className="benefit-card">
							<div className="benefit-icon">
								<TrendingUp size={40} />
							</div>
							<h3 className="benefit-title">生産性90%向上</h3>
							<p className="benefit-desc">
								議事録作成時間の完全削減により、本来の業務に集中
							</p>
							<div className="benefit-stat">週8時間の工数削減</div>
						</div>
						<div className="benefit-card">
							<div className="benefit-icon">
								<MessageSquare size={40} />
							</div>
							<h3 className="benefit-title">情報共有品質向上</h3>
							<p className="benefit-desc">
								AIによる一定品質で、重要な情報の見落としゼロ
							</p>
							<div className="benefit-stat">共有漏れ95%削減</div>
						</div>
						<div className="benefit-card">
							<div className="benefit-icon">
								<Users size={40} />
							</div>
							<h3 className="benefit-title">チーム連携強化</h3>
							<p className="benefit-desc">
								即座の情報共有で意思決定スピードが劇的に改善
							</p>
							<div className="benefit-stat">決定速度3倍向上</div>
						</div>
					</div>
				</div>
			</section>

			{/* Testimonials Section */}
			<section className="testimonials">
				<div className="testimonials-content">
					<h2 className="testimonials-title">お客様の声</h2>
					<div className="testimonials-grid">
						<div className="testimonial-card">
							<div className="testimonial-stars">
								{[...Array(5)].map((_, i) => (
									<Star key={i} size={16} fill="currentColor" />
								))}
							</div>
							<p className="testimonial-text">
								「会議の質が劇的に向上しました。参加者も議事録作成の心配なく、
								議論に集中できるようになりました。」
							</p>
							<div className="testimonial-author">
								<div className="testimonial-avatar">TK</div>
								<div className="testimonial-info">
									<div className="testimonial-name">田中 健一さん</div>
									<div className="testimonial-company">株式会社テクノロジー 部長</div>
								</div>
							</div>
						</div>
						<div className="testimonial-card">
							<div className="testimonial-stars">
								{[...Array(5)].map((_, i) => (
									<Star key={i} size={16} fill="currentColor" />
								))}
							</div>
							<p className="testimonial-text">
								「導入3ヶ月で議事録関連の作業時間が90%削減。
								浮いた時間で新しいプロジェクトに取り組めています。」
							</p>
							<div className="testimonial-author">
								<div className="testimonial-avatar">SY</div>
								<div className="testimonial-info">
									<div className="testimonial-name">佐藤 由美さん</div>
									<div className="testimonial-company">合同会社イノベーション PM</div>
								</div>
							</div>
						</div>
						<div className="testimonial-card">
							<div className="testimonial-stars">
								{[...Array(5)].map((_, i) => (
									<Star key={i} size={16} fill="currentColor" />
								))}
							</div>
							<p className="testimonial-text">
								「リモートワークでも全員が同じ情報を共有できるように。
								チーム全体の一体感が格段に向上しました。」
							</p>
							<div className="testimonial-author">
								<div className="testimonial-avatar">MK</div>
								<div className="testimonial-info">
									<div className="testimonial-name">山田 美香さん</div>
									<div className="testimonial-company">株式会社グローバル CTO</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Pricing Section */}
			<section className="pricing">
				<div className="pricing-content">
					<h2 className="pricing-title">
						<span className="pricing-highlight">シンプルな料金体系</span>
					</h2>
					<p className="pricing-subtitle">
						企業規模に関わらず、すぐに始められる料金設定
					</p>
					<div className="pricing-grid">
						<div className="pricing-card">
							<h3 className="pricing-card-title">スターター</h3>
							<div className="pricing-card-price">
								<span className="pricing-currency">¥</span>
								<span className="pricing-amount">2,980</span>
								<span className="pricing-period">/月</span>
							</div>
							<ul className="pricing-features">
								<li><CheckCircle size={16} /> 月20回まで処理</li>
								<li><CheckCircle size={16} /> メール配信</li>
								<li><CheckCircle size={16} /> 基本セキュリティ</li>
								<li><CheckCircle size={16} /> メールサポート</li>
							</ul>
							<Link to="/register" className="pricing-btn secondary">
								14日間無料トライアル
							</Link>
						</div>
						<div className="pricing-card featured">
							<div className="pricing-badge">人気</div>
							<h3 className="pricing-card-title">ビジネス</h3>
							<div className="pricing-card-price">
								<span className="pricing-currency">¥</span>
								<span className="pricing-amount">9,980</span>
								<span className="pricing-period">/月</span>
							</div>
							<ul className="pricing-features">
								<li><CheckCircle size={16} /> 月100回まで処理</li>
								<li><CheckCircle size={16} /> メール + Slack配信</li>
								<li><CheckCircle size={16} /> マルチテナント対応</li>
								<li><CheckCircle size={16} /> 管理画面アクセス</li>
								<li><CheckCircle size={16} /> 電話サポート</li>
							</ul>
							<Link to="/register" className="pricing-btn primary">
								今すぐ始める
							</Link>
						</div>
						<div className="pricing-card">
							<h3 className="pricing-card-title">エンタープライズ</h3>
							<div className="pricing-card-price">
								<span className="pricing-text">お問い合わせ</span>
							</div>
							<ul className="pricing-features">
								<li><CheckCircle size={16} /> 無制限処理</li>
								<li><CheckCircle size={16} /> カスタム配信</li>
								<li><CheckCircle size={16} /> 専用セキュリティ</li>
								<li><CheckCircle size={16} /> API連携</li>
								<li><CheckCircle size={16} /> 専任サポート</li>
							</ul>
							<Link to="/contact" className="pricing-btn secondary">
								相談する
							</Link>
						</div>
					</div>
				</div>
			</section>

			{/* CTA Section */}
			<section className="final-cta">
				<div className="final-cta-content">
					<h2 className="final-cta-title">
						今すぐ始めて、<br />
						<span className="final-cta-highlight">会議の生産性を革新</span>しませんか？
					</h2>
					<p className="final-cta-subtitle">
						14日間の無料トライアルで、AI議事録システムの威力を実感してください
					</p>
					<form onSubmit={handleEmailSubmit} className="final-cta-form">
						<input
							type="email"
							placeholder="メールアドレスを入力"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className="final-cta-input"
							required
						/>
						<button type="submit" className="final-cta-btn">
							無料で始める
						</button>
					</form>
					<p className="final-cta-note">
						<CheckCircle size={16} />
						クレジットカード不要・即座に開始・いつでもキャンセル可能
					</p>
				</div>
			</section>
		</div>
	);
};

export default LandingPage;