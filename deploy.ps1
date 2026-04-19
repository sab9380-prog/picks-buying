# picks-buying 재배포용
# 사용: .\deploy.ps1
Copy-Item picks-v5.html dist/index.html -Force
npx wrangler pages deploy dist --project-name=picks-buying --branch=main --commit-dirty=true
