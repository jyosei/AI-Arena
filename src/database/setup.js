const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function testConnection() {
  console.log('测试数据库连接...');
  console.log('配置信息:');
  console.log('- Host:', process.env.DB_HOST || 'localhost');
  console.log('- Port:', process.env.DB_PORT || '3306');
  console.log('- User:', process.env.DB_USER || 'root');
  console.log('- Password:', process.env.DB_PASSWORD ? '***已设置***' : '***未设置***');
  console.log('');
  
  const mysql = require('mysql2/promise');
  
  try {
    // 先尝试连接（不指定数据库）
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || ''
    });
    
    console.log('✓ 数据库连接成功！');
    await connection.end();
    return true;
  } catch (error) {
    console.error('✗ 数据库连接失败！');
    console.error('错误信息:', error.message);
    console.error('');
    console.error('请检查:');
    console.error('1. MySQL服务是否正在运行');
    console.error('2. .env文件中的用户名和密码是否正确');
    console.error('3. 用户是否有足够的权限');
    console.error('');
    console.error('如果使用Docker MySQL，请尝试:');
    console.error('   DB_HOST=127.0.0.1 或实际的Docker容器IP');
    return false;
  }
}

async function setupDatabase() {
  try {
    // 先测试连接
    const connected = await testConnection();
    if (!connected) {
      process.exit(1);
    }
    
    console.log('正在初始化数据库...');
    
    const mysql = require('mysql2/promise');
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      multipleStatements: true
    });
    
    const sqlFile = path.join(__dirname, 'init.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    await connection.query(sql);
    
    console.log('✓ 数据库初始化完成！');
    await connection.end();
  } catch (error) {
    console.error('✗ 数据库初始化失败:', error.message);
    throw error;
  }
}

setupDatabase()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
