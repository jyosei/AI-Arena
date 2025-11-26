import React, { useState } from 'react';
import { Modal, Space, Typography, Button, message, Divider } from 'antd';
import { QRCodeSVG } from 'qrcode.react';
import { CopyOutlined, DownloadOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;

export default function ShareModal({ visible, onClose, shareUrl, title }) {
  const [downloading, setDownloading] = useState(false);

  const handleCopyLink = () => {
    // 在非安全上下文 (http 公网 IP) 下 clipboard API 可能不可用，做降级处理
    try {
      if (navigator?.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(shareUrl).then(() => {
          message.success('链接已复制到剪贴板');
        }).catch(() => {
          message.error('复制失败');
        });
        return;
      }
      // 回退：使用隐藏 textarea + execCommand('copy')
      const textarea = document.createElement('textarea');
      textarea.value = shareUrl;
      textarea.style.position = 'fixed';
      textarea.style.top = '-1000px';
      textarea.style.left = '-1000px';
      textarea.setAttribute('readonly', '');
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (ok) {
        message.success('链接已复制');
      } else {
        message.warning('复制失败，请手动选中复制');
      }
    } catch (e) {
      message.warning('自动复制不可用，请手动选中链接');
    }
  };

  const handleDownloadQR = () => {
    setDownloading(true);
    try {
      // 获取二维码 SVG 元素
      const svg = document.getElementById('share-qrcode');
      if (!svg) {
        message.error('二维码未加载');
        return;
      }

      // 创建 canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const svgData = new XMLSerializer().serializeToString(svg);
      const img = new Image();
      
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        
        // 下载图片
        canvas.toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `qrcode-${Date.now()}.png`;
          link.click();
          URL.revokeObjectURL(url);
          message.success('二维码已下载');
          setDownloading(false);
        });
      };
      
      img.onerror = () => {
        message.error('下载失败');
        setDownloading(false);
      };
      
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    } catch (error) {
      console.error('Download error:', error);
      message.error('下载失败');
      setDownloading(false);
    }
  };

  return (
    <Modal
      title="分享帖子"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={500}
      centered
    >
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <Title level={5} style={{ marginBottom: 20 }}>
          {title || '扫码查看帖子'}
        </Title>
        
        {/* 二维码 */}
        <div style={{ 
          display: 'inline-block', 
          padding: 20, 
          background: 'white',
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <QRCodeSVG 
            id="share-qrcode"
            value={shareUrl} 
            size={240}
            level="H"
            includeMargin={true}
          />
        </div>

        <Divider />

        {/* 分享链接 */}
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Text type="secondary">分享链接</Text>
            <div style={{ 
              marginTop: 8,
              padding: '12px 16px',
              background: '#f5f5f5',
              borderRadius: 4,
              wordBreak: 'break-all',
              fontSize: '14px'
            }}>
              {shareUrl}
            </div>
          </div>

          {/* 操作按钮 */}
          <Space size="middle" style={{ width: '100%', justifyContent: 'center' }}>
            <Button 
              type="primary" 
              icon={<CopyOutlined />}
              onClick={handleCopyLink}
            >
              复制链接
            </Button>
            <Button 
              icon={<DownloadOutlined />}
              onClick={handleDownloadQR}
              loading={downloading}
            >
              下载二维码
            </Button>
          </Space>

          <Text type="secondary" style={{ fontSize: 12 }}>
            移动端扫描二维码即可查看此帖子
          </Text>
        </Space>
      </div>
    </Modal>
  );
}
