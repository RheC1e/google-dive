# GitHub 專案上傳流程與文件紀錄

這份文件記錄了將專案 `Dive-Trainer` 上傳至 GitHub 儲存庫 `https://github.com/RheC1e/google-dive` 的詳細步驟與變更。

## 1. 專案狀態檢查與準備

在開始上傳之前，我們執行了以下檢查：

- **檢查 SSH 設定**：確認本機 `~/.ssh` 目錄下已有 SSH 金鑰，並透過 `ssh -T git@github.com` 驗證與 GitHub 的連線成功。
- **檢查 Git 狀態**：確認專案目前位於 `main` 分支，並且有未提交的變更（`app.js`, `index.html`, `styles.css`, `sw.js` 等）。
- **設定使用者資訊**：設定了 Git 的使用者名稱與 Email：
  - Email: `rhemaluis125@gmail.com`
  - Name: `RheC1e`

## 2. 執行上傳步驟

我們執行了以下指令來將專案同步到遠端儲存庫：

1.  **設定遠端網址 (Remote URL)**：
    將原本的 origin 網址修改為新的目標儲存庫：
    ```bash
    git remote set-url origin git@github.com:RheC1e/google-dive.git
    ```

2.  **新增 .gitignore 檔案**：
    為了避免將系統檔案（如 macOS 的 `.DS_Store`）上傳到版本控制中，我們建立了一個 `.gitignore` 檔案。

3.  **加入與提交變更 (Add & Commit)**：
    將所有檔案加入暫存區並提交：
    ```bash
    git add .
    git commit -m "Update project and prepare for Vercel deployment"
    ```

4.  **推送到遠端 (Push)**：
    將本地的 `main` 分支推送到 GitHub：
    ```bash
    git push -u origin main
    ```

## 3. 檔案變更紀錄

在此次操作中，主要變更如下：

- **[NEW] .gitignore**: 新增此檔案以排除非必要的系統檔案。
- **[MODIFY] 專案核心檔案**: `app.js`, `index.html`, `styles.css`, `sw.js` 等檔案的最新修改皆已同步上傳。

## 4. 後續步驟

專案目前已成功上傳至 GitHub。您現在可以前往 Vercel 進行導入：

1.  登入 Vercel。
2.  點擊 "Add New..." -> "Project"。
3.  選擇 "Import" 旁邊的 GitHub。
4.  搜尋並選擇 `google-dive` 儲存庫。
5.  點擊 "Deploy"。

---

## 5. 更新紀錄

### 2025-11-19 16:16 - 拖曳性能優化
**Commit**: `7493d8a`  
**訊息**: "Optimize drag and drop performance with RAF and GPU acceleration"

**變更檔案**：
- `app.js`: 重構拖曳邏輯，使用 requestAnimationFrame 和交換節流
- `styles.css`: 加入 GPU 加速屬性（translate3d, will-change, touch-action）

**優化內容**：
- 使用 RAF 限制更新頻率至 60fps
- 實作 50ms 交換節流機制
- 啟用 GPU 硬體加速
- 改善觸摸事件處理

---
**上傳狀態**： ✅ 成功  
**最後更新**： 2025-11-19 16:16
