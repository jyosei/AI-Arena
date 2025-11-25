# AI-Arena API测试脚本 (PowerShell)

$baseUrl = "http://localhost:3000"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "AI-Arena API 测试脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. 健康检查
Write-Host "1️⃣  测试健康检查..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/health" -Method Get
    Write-Host "✓ 服务器运行正常" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json) -ForegroundColor Gray
} catch {
    Write-Host "✗ 健康检查失败: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 2. 注册用户
Write-Host "2️⃣  测试用户注册..." -ForegroundColor Yellow
$registerBody = @{
    username = "testuser_$(Get-Random -Maximum 9999)"
    email = "test_$(Get-Random -Maximum 9999)@example.com"
    password = "password123"
} | ConvertTo-Json

try {
    $registerResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/register" `
        -Method Post `
        -Body $registerBody `
        -ContentType "application/json"
    
    Write-Host "✓ 注册成功" -ForegroundColor Green
    Write-Host "用户ID: $($registerResponse.data.user.id)" -ForegroundColor Gray
    Write-Host "用户名: $($registerResponse.data.user.username)" -ForegroundColor Gray
    Write-Host "邮箱: $($registerResponse.data.user.email)" -ForegroundColor Gray
    
    $username = $registerResponse.data.user.username
    $token = $registerResponse.data.token
    
    Write-Host "Token: $($token.Substring(0, 20))..." -ForegroundColor Gray
} catch {
    Write-Host "✗ 注册失败: $_" -ForegroundColor Red
    Write-Host $_.Exception.Response.StatusCode -ForegroundColor Red
}
Write-Host ""

# 3. 登录
Write-Host "3️⃣  测试用户登录..." -ForegroundColor Yellow
$loginBody = @{
    username = $username
    password = "password123"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" `
        -Method Post `
        -Body $loginBody `
        -ContentType "application/json"
    
    Write-Host "✓ 登录成功" -ForegroundColor Green
    Write-Host "用户名: $($loginResponse.data.user.username)" -ForegroundColor Gray
    Write-Host "评分: $($loginResponse.data.user.rating)" -ForegroundColor Gray
    
    $token = $loginResponse.data.token
} catch {
    Write-Host "✗ 登录失败: $_" -ForegroundColor Red
}
Write-Host ""

# 4. 创建帖子
Write-Host "4️⃣  测试创建帖子..." -ForegroundColor Yellow
$postBody = @{
    title = "测试帖子 - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    content = "这是一篇测试帖子的内容。验证数据库存储功能。"
} | ConvertTo-Json

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

try {
    $postResponse = Invoke-RestMethod -Uri "$baseUrl/api/posts" `
        -Method Post `
        -Body $postBody `
        -Headers $headers
    
    Write-Host "✓ 创建帖子成功" -ForegroundColor Green
    Write-Host "帖子ID: $($postResponse.data.id)" -ForegroundColor Gray
    Write-Host "标题: $($postResponse.data.title)" -ForegroundColor Gray
    Write-Host "作者: $($postResponse.data.username)" -ForegroundColor Gray
    
    $postId = $postResponse.data.id
} catch {
    Write-Host "✗ 创建帖子失败: $_" -ForegroundColor Red
}
Write-Host ""

# 5. 获取所有帖子
Write-Host "5️⃣  测试获取所有帖子..." -ForegroundColor Yellow
try {
    $postsResponse = Invoke-RestMethod -Uri "$baseUrl/api/posts" -Method Get
    $postCount = $postsResponse.data.Count
    
    Write-Host "✓ 获取成功，共 $postCount 篇帖子" -ForegroundColor Green
    
    if ($postCount -gt 0) {
        Write-Host "最新帖子:" -ForegroundColor Gray
        $postsResponse.data[0..([Math]::Min(2, $postCount-1))] | ForEach-Object {
            Write-Host "  - [$($_.id)] $($_.title) by $($_.username)" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "✗ 获取帖子失败: $_" -ForegroundColor Red
}
Write-Host ""

# 6. 获取单个帖子
Write-Host "6️⃣  测试获取单个帖子..." -ForegroundColor Yellow
try {
    $singlePostResponse = Invoke-RestMethod -Uri "$baseUrl/api/posts/$postId" -Method Get
    
    Write-Host "✓ 获取成功" -ForegroundColor Green
    Write-Host "标题: $($singlePostResponse.data.title)" -ForegroundColor Gray
    Write-Host "内容: $($singlePostResponse.data.content)" -ForegroundColor Gray
    Write-Host "浏览量: $($singlePostResponse.data.views)" -ForegroundColor Gray
} catch {
    Write-Host "✗ 获取单个帖子失败: $_" -ForegroundColor Red
}
Write-Host ""

# 7. 获取我的帖子
Write-Host "7️⃣  测试获取我的帖子..." -ForegroundColor Yellow
try {
    $myPostsResponse = Invoke-RestMethod -Uri "$baseUrl/api/posts/user/my" `
        -Method Get `
        -Headers @{ "Authorization" = "Bearer $token" }
    
    $myPostCount = $myPostsResponse.data.Count
    Write-Host "✓ 获取成功，我发布了 $myPostCount 篇帖子" -ForegroundColor Green
} catch {
    Write-Host "✗ 获取我的帖子失败: $_" -ForegroundColor Red
}
Write-Host ""

# 总结
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✓ 所有测试完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "💡 验证数据库:" -ForegroundColor Yellow
Write-Host "   mysql -h 127.0.0.1 -P 3306 -u root -p123456 -e `"USE aiarena; SELECT * FROM users; SELECT * FROM posts;`"" -ForegroundColor Gray
