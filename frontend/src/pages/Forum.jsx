import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  List,
  Spin,
  Input,
  Select,
  Row,
  Col,
  Space,
  Typography,
  Avatar,
  Tag,
} from 'antd';
import {
  MessageOutlined,
  UserOutlined,
  ClockCircleOutlined,
  FireOutlined,
  PlusOutlined,
} from '@ant-design/icons';

const { Search } = Input;
const { Option } = Select;
const { Text, Title } = Typography;

// 1. 模拟的帖子数据
const fakePosts = [
  {
    id: 1,
    title: '大家觉得哪个模型在写代码方面表现最好？',
    author: 'AI爱好者',
    replies: 12,
    views: 152,
    lastActivity: '5 分钟前',
    avatar: 'https://joeschmoe.io/api/v1/random',
    tags: ['技术讨论', '代码'],
  },
  {
    id: 2,
    title: 'Compare 页面 Battle 模式的建议：希望增加匿名投票',
    author: '产品经理',
    replies: 5,
    views: 88,
    lastActivity: '1 小时前',
    avatar: 'https://joeschmoe.io/api/v1/female',
    tags: ['功能建议'],
  },
  {
    id: 3,
    title: 'Leaderboard 分数是如何计算的？',
    author: '数据科学家',
    replies: 3,
    views: 201,
    lastActivity: '3 小时前',
    avatar: 'https://joeschmoe.io/api/v1/male',
    tags: ['问题'],
  },
  {
    id: 4,
    title: '我用 GLM-4 写了一首诗，大家品鉴一下',
    author: '诗人',
    replies: 28,
    views: 540,
    lastActivity: '8 小时前',
    avatar: 'https://joeschmoe.io/api/v1/T',
    tags: ['作品分享', 'GLM-4'],
  },
];

export default function Forum() {
  const [loading, setLoading] = useState(false);
  const [posts, setPosts] = useState([]);

  // 2. 模拟数据获取
  const fetchPosts = () => {
    setLoading(true);
    // 模拟 API 调用
    setTimeout(() => {
      setPosts(fakePosts);
      setLoading(false);
    }, 800);
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  // 渲染列表项的统计信息
  const IconText = ({ icon, text }) => (
    <Space>
      {React.createElement(icon)}
      {text}
    </Space>
  );

  // 3. 页面布局 (参考 Leaderboard 和 Compare)
  return (
    <Card title="社区论坛">
      {/* 控件区域，参考 Leaderboard 和 Compare */}
      <Row
        justify="space-between"
        align="middle"
        style={{ marginBottom: 24 }}
      >
        <Col>
          <Space wrap size="middle">
            <Select defaultValue="latest" style={{ width: 180 }}>
              <Option value="latest">
                <ClockCircleOutlined /> 最新回复
              </Option>
              <Option value="newest">
                <PlusOutlined /> 最新发布
              </Option>
              <Option value="hot">
                <FireOutlined /> 热门帖子
              </Option>
            </Select>
            <Search
              placeholder="搜索帖子标题或内容..."
              onSearch={(value) => console.log(value)}
              style={{ width: 300 }}
            />
          </Space>
        </Col>
        <Col>
          <Button type="primary" size="large" icon={<PlusOutlined />}>
            发布新帖
          </Button>
        </Col>
      </Row>

      {/* 4. 帖子列表区域 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <Spin size="large" tip="正在加载帖子..." />
        </div>
      ) : (
        <List
          itemLayout="vertical"
          size="large"
          dataSource={posts}
          renderItem={(item) => (
            <List.Item
              key={item.id}
              actions={[
                <IconText
                  icon={UserOutlined}
                  text={item.author}
                  key="list-author"
                />,
                <IconText
                  icon={MessageOutlined}
                  text={item.replies}
                  key="list-replies"
                />,
                <IconText
                  icon={ClockCircleOutlined}
                  text={`最后回复 ${item.lastActivity}`}
                  key="list-activity"
                />,
              ]}
              extra={
                <Space direction="vertical" align="end">
                  <Text type="secondary">{item.views} 浏览</Text>
                  <div>
                    {item.tags.map((tag) => (
                      <Tag key={tag}>{tag}</Tag>
                    ))}
                  </div>
                </Space>
              }
            >
              <List.Item.Meta
                avatar={<Avatar src={item.avatar} icon={<UserOutlined />} />}
                title={
                  <a href={`/forum/post/${item.id}`}>
                    <Title level={5} style={{ marginBottom: 0 }}>
                      {item.title}
                    </Title>
                  </a>
                }
                description={
                  <Text type="secondary">
                    由 {item.author} 发布于 2025-11-11
                  </Text>
                } // 只是占位日期
              />
            </List.Item>
          )}
        />
      )}
    </Card>
  );
}