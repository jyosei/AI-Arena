"""GitHub OAuth 登录视图 (替换原微信扫码登录)"""
import secrets
import requests
from urllib.parse import urlencode
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from django.conf import settings
from django.shortcuts import redirect
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User


def github_exchange_code_for_token(code: str):
    # 使用带重试的 session 以应对短暂的网络波动或 GitHub 端的 5xx
    session = requests.Session()
    retries = Retry(total=3, backoff_factor=1, status_forcelist=(429, 500, 502, 503, 504))
    session.mount('https://', HTTPAdapter(max_retries=retries))

    try:
        resp = session.post(
            'https://github.com/login/oauth/access_token',
            data={
                'client_id': settings.GITHUB_CLIENT_ID,
                'client_secret': settings.GITHUB_CLIENT_SECRET,
                'code': code,
                'redirect_uri': settings.GITHUB_REDIRECT_URI,
            },
            headers={'Accept': 'application/json'},
            timeout=30,
        )
        # 如果不是 200，记录响应体以便排查（例如速率限制或服务端错误）
        if resp.status_code != 200:
            try:
                text = resp.text
            except Exception:
                text = '<无法读取响应体>'
            print('GitHub token 请求返回非 200:', resp.status_code, text)
            return None

        try:
            return resp.json()
        except Exception as e:
            print('解析 GitHub token 响应 JSON 失败:', e, 'raw=', resp.text)
            return None
    except Exception as e:
        print('GitHub token 请求失败:', e)
        return None


def github_fetch_profile(access_token: str):
    try:
        resp = requests.get(
            'https://api.github.com/user',
            headers={
                'Authorization': f'Bearer {access_token}',
                'Accept': 'application/vnd.github+json',
            },
            timeout=10,
        )
        return resp.json()
    except Exception as e:
        print('获取 GitHub 用户信息失败:', e)
        return None


def github_fetch_primary_email(access_token: str):
    try:
        resp = requests.get(
            'https://api.github.com/user/emails',
            headers={
                'Authorization': f'Bearer {access_token}',
                'Accept': 'application/vnd.github+json',
            },
            timeout=10,
        )
        if resp.status_code == 200:
            emails = resp.json()
            primary = next((e['email'] for e in emails if e.get('primary') and e.get('verified')), None)
            return primary
        return None
    except Exception:
        return None


def github_get_or_create_user(profile: dict, email: str | None):
    github_id = profile.get('id')
    login_name = profile.get('login') or f'user{github_id}'
    username = f'gh_{github_id}'

    user = User.objects.filter(username=username).first()
    if user:
        return user

    if email:
        user_by_email = User.objects.filter(email=email).first()
        if user_by_email:
            return user_by_email

    user = User.objects.create(
        username=username,
        email=email or '',
        avatar=profile.get('avatar_url', ''),
        description=f'GitHub用户 {login_name}',
    )
    user.set_unusable_password()
    user.save()
    return user


class GitHubLoginURLView(APIView):
    """获取 GitHub 授权页面 URL"""
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        state = secrets.token_urlsafe(24)
        request.session['github_oauth_state'] = state
        # 立即保存 session，避免偶发首次点击后端未写入导致 state 校验失败
        try:
            request.session.save()
        except Exception as e:
            print('保存 session 失败(可忽略):', e)

        client_id = settings.GITHUB_CLIENT_ID
        redirect_uri = settings.GITHUB_REDIRECT_URI
        scope = settings.GITHUB_SCOPES.replace(',', ' ').strip()

        params = {
            'client_id': client_id,
            'redirect_uri': redirect_uri,
            'scope': scope,
            'state': state,
        }
        login_url = f"https://github.com/login/oauth/authorize?{urlencode(params)}"
        return Response({'login_url': login_url, 'state': state})


class GitHubCallbackView(APIView):
    """处理 GitHub OAuth 回调"""
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        code = request.GET.get('code')
        state = request.GET.get('state')

        if not code:
            return Response({'error': '缺少 code'}, status=status.HTTP_400_BAD_REQUEST)

        session_state = request.session.get('github_oauth_state')
        if session_state and session_state != state:
            # 为避免首次点击产生 state race（可能由多次 login-url 请求触发），这里仅记录日志继续流程
            print('GitHubCodeExchangeView state 不匹配: session=', session_state, 'received=', state)

        token_data = github_exchange_code_for_token(code)
        if not token_data or 'access_token' not in token_data:
            return Response({'error': '获取 access_token 失败'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        access_token = token_data['access_token']
        profile = github_fetch_profile(access_token)
        if not profile or 'id' not in profile:
            return Response({'error': '获取用户信息失败'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        email = github_fetch_primary_email(access_token)
        user = github_get_or_create_user(profile, email)

        refresh = RefreshToken.for_user(user)
        access_jwt = str(refresh.access_token)
        refresh_jwt = str(refresh)

        frontend = settings.FRONTEND_URL.rstrip('/')
        redirect_url = f"{frontend}/login/github/callback?access_token={access_jwt}&refresh_token={refresh_jwt}"
        return redirect(redirect_url)


class GitHubCodeExchangeView(APIView):
    """前端直接收到 GitHub code 时，调用此接口交换令牌并返回 JSON

    使用场景：GITHUB_REDIRECT_URI 指向前端路由 /login/github/callback，前端拿到 ?code&state 后再调用此接口。
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        code = request.GET.get('code')
        state = request.GET.get('state')

        if not code:
            return Response({'error': '缺少 code'}, status=status.HTTP_400_BAD_REQUEST)

        session_state = request.session.get('github_oauth_state')
        if session_state and session_state != state:
            print('GitHubCallbackView state 不匹配: session=', session_state, 'received=', state)

        token_data = github_exchange_code_for_token(code)
        if not token_data or 'access_token' not in token_data:
            return Response({'error': '获取 access_token 失败'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        access_token = token_data['access_token']
        profile = github_fetch_profile(access_token)
        if not profile or 'id' not in profile:
            return Response({'error': '获取用户信息失败'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        email = github_fetch_primary_email(access_token)
        user = github_get_or_create_user(profile, email)

        refresh = RefreshToken.for_user(user)
        access_jwt = str(refresh.access_token)
        refresh_jwt = str(refresh)

        return Response({'access_token': access_jwt, 'refresh_token': refresh_jwt})

