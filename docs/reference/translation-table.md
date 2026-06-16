# 用語対訳テーブル

## 基本用語

| 日本語用語         | 英語表記                   | 意味 / 説明                                | システム内での表現  | 備考                               |
| ------------------ | -------------------------- | ------------------------------------------ | ------------------- | ---------------------------------- |
| Volunty            | Volunty                    | ボランティア活動マッチングプラットフォーム | アプリ名            |                                    |
| 参加者             | Participant                | ボランティア活動に参加したい個人ユーザー   | ParticipantProfile  | DBテーブル: m_participant_profile  |
| 団体               | Organization               | ボランティアを募集するNPO法人等の組織      | OrganizationProfile | DBテーブル: m_organization_profile |
| 募集案件           | Opportunity                | 団体が作成するボランティア活動の募集情報   | Opportunity         | DBテーブル: m_opportunity          |
| 応募               | Application                | 参加者が募集案件に応募すること             | MatchingCandidate   | DBテーブル: t_matching_candidate   |
| マッチングスコア   | Matching Score             | 参加者と団体の相性を数値化したもの         | score               | 0-100の範囲で算出                  |
| 相性スコア         | Compatibility Score        | マッチングスコアと同義                     | score               | UI表示用の言い換え                 |
| 承認               | Approval                   | 団体が応募を受け入れること                 | status: matched     | ステータス遷移                     |
| 辞退               | Decline / Rejection        | 団体が応募を断ること                       | status: declined    | ステータス遷移                     |
| 参加証明書         | Participation Certificate  | ボランティア活動完了後に発行される証明書   | Certificate         | DBテーブル: t_certificate          |
| 証明書発行         | Certificate Issuance       | 参加証明書を生成・交付すること             | certificate_status  | 発行リクエスト→承認→発行の流れ     |
| 活動完了報告       | Activity Completion Report | 団体が活動終了を記録すること               | status: completed   | 証明書発行の前提条件               |
| 双方向アプローチ   | Bidirectional Approach     | 団体から参加者へ一回きりのアプローチ文を送る仕組み | Approach            | DBテーブル: t_approach             |
| アプローチ送信     | Send Approach              | 団体が参加者にアプローチ文を送ること       | approach_status     | 送信→承諾/辞退。14日で期限切れ表示 |
| アプローチ受信     | Receive Approach           | 参加者が団体からのアプローチを確認すること | approach_status     | 未回答→承諾/辞退                   |
| アプローチ文       | Approach Text              | 団体が参加者に送る一回きりの勧誘文         | approach_message    | アプリ内チャットは持たない         |
| 団体審査           | Organization Review        | 管理者が団体登録を承認・却下するプロセス   | review_status       | DBテーブル: t_organization_review  |
| 審査ステータス     | Review Status              | 審査の進行状態（申請中、承認、却下）       | status              | pending / approved / rejected      |
| 審査承認           | Approval                   | 管理者が団体登録を許可すること             | status: approved    | 承認後、団体は全機能にアクセス可能 |
| 審査却下           | Rejection                  | 管理者が団体登録を不許可にすること         | status: rejected    | 却下理由を記録                     |
## 性格診断関連用語

| 日本語用語     | 英語表記                 | 意味 / 説明                                       | システム内での表現 | 備考                              |
| -------------- | ------------------------ | ------------------------------------------------- | ------------------ | --------------------------------- |
| ビッグファイブ | BIG5 / Five Factor Model | 開放性、誠実性、外向性、協調性、神経症傾向の5因子 | BIG5Scores         | 性格特性の分析手法                |
| 外向性         | Extraversion (E)         | 社交性、活動性、刺激追求の度合い                  | extraversion       | スコア範囲: 0-100                 |
| 協調性         | Agreeableness (A)        | 共感性、協力性、信頼性の度合い                    | agreeableness      | スコア範囲: 0-100                 |
| 誠実性         | Conscientiousness (C)    | 計画性、責任感、自己統制の度合い                  | conscientiousness  | スコア範囲: 0-100                 |
| 神経症傾向     | Neuroticism (N)          | 感情の不安定性、ストレス感受性の度合い            | neuroticism        | スコア範囲: 0-100                 |
| 開放性         | Openness (O)             | 好奇心、創造性、新規性受容の度合い                | openness           | スコア範囲: 0-100                 |
| 人物タイプ     | Personality Type         | BIG5スコアに基づく10類型の性格分類                | PersonalityType    | DBテーブル: m_personality_type    |
| 診断結果       | Diagnosis Result         | 性格診断の結果データ                              | DiagnosisResult    | DBテーブル: t_diagnosis_result    |
| 逆転項目       | Reversed Item            | スコア計算時に逆転処理が必要な質問                | reversed: true     | 例: 「話すのが苦手だ」→外向性の逆 |

## システム・技術用語

| 日本語用語     | 英語表記                    | 意味 / 説明                  | システム内での表現 | 備考                               |
| -------------- | --------------------------- | ---------------------------- | ------------------ | ---------------------------------- |
| MBTI           | Myers-Briggs Type Indicator | 16タイプの性格分類手法       | MBTI               | 参考として言及するが主軸はBIG5     |
| OAuth          | OAuth 2.0                   | 外部認証プロトコル           | OAuth              | Google / LINE 認証に使用           |
| ロール         | Role                        | ユーザーの権限区分           | role               | participant / organization / admin |
| プロフィール   | Profile                     | ユーザーの詳細情報           | Profile            | 参加者・団体それぞれに存在         |
| ダッシュボード | Dashboard                   | 団体向けの管理画面トップ     | /dashboard         | 募集案件管理・応募者確認           |
| マイページ     | My Page                     | 参加者向けの個人ページトップ | /mypage            | 応募状況確認・プロフィール編集     |
| LP             | Landing Page                | サービス紹介ページ           | /                  | トップページ                       |
| CTA            | Call To Action              | 行動喚起ボタン               | -                  | 「診断を始める」「応募する」等     |

## 外部連携用語

| 日本語用語         | 英語表記                | 意味 / 説明                        | システム内での表現 | 備考                     |
| ------------------ | ----------------------- | ---------------------------------- | ------------------ | ------------------------ |
| 東京アプリ         | Tokyo App               | 東京都が提供する行政サービスアプリ | 東京アプリ         | Phase 3 以降で連携予定   |
| NPO法人            | Non-Profit Organization | 特定非営利活動法人                 | NPO法人            | 主な団体ユーザー層       |
| LINE公式アカウント | LINE Official Account   | LINEの法人向けアカウント           | contact_line_id    | 団体の連絡手段として登録 |


## 追加候補のメモ
- 未定義の重要語句や省略語をリストアップし、Issue で議論する。
- UI 文言と内部モデル名が異なる場合は理由を追記。
