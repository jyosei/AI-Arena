# Test Direct Chat Mode
Write-Host "Testing Direct Chat Mode..." -ForegroundColor Yellow
$loginBody = @{username='ett'; password='test123456'} | ConvertTo-Json
$loginResponse = Invoke-WebRequest -Uri http://localhost:8000/api/token/ -Method POST -Body $loginBody -ContentType 'application/json'
$token = ($loginResponse.Content | ConvertFrom-Json).access

$directBody = @{model_name='gpt-3.5-turbo'; prompt='Test direct chat'; is_direct_chat=$true} | ConvertTo-Json
$headers = @{Authorization="Bearer $token"; 'Content-Type'='application/json'}
$directResponse = Invoke-WebRequest -Uri http://localhost:8000/api/models/battle/ -Method POST -Headers $headers -Body $directBody
$directResult = $directResponse.Content | ConvertFrom-Json
Write-Host "Direct Chat Conversation ID: $($directResult.conversation_id)" -ForegroundColor Green
