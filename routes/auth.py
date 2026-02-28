from flask import Blueprint, request, jsonify, render_template, session, redirect, url_for, current_app
from config import Config

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/login')
def login():
    """Show login page"""
    if session.get('user_email'):
        return redirect('/')
    return render_template('login.html')


@auth_bp.route('/auth/google')
def auth_google():
    """Initiate Google OAuth flow"""
    google = current_app.extensions['google_oauth']
    redirect_uri = url_for('auth.auth_callback', _external=True)
    return google.authorize_redirect(redirect_uri)


@auth_bp.route('/auth/callback')
def auth_callback():
    """Handle Google OAuth callback"""
    google = current_app.extensions['google_oauth']
    token = google.authorize_access_token()
    user_info = token.get('userinfo')

    if not user_info:
        user_info = google.get('https://openidconnect.googleapis.com/v1/userinfo').json()

    email = user_info.get('email', '').lower()

    if email not in Config.ALLOWED_EMAILS:
        return render_template('login.html',
            error=f'Access denied. The email {email} is not authorized to use this application.')

    session['user_email'] = email
    session['user_name'] = user_info.get('name', email)
    session['user_picture'] = user_info.get('picture', '')
    session.permanent = True

    return redirect('/')


@auth_bp.route('/auth/microsoft')
def auth_microsoft():
    """Initiate Microsoft OAuth flow"""
    microsoft = current_app.extensions['microsoft_oauth']
    redirect_uri = url_for('auth.auth_microsoft_callback', _external=True)
    return microsoft.authorize_redirect(redirect_uri)


@auth_bp.route('/auth/microsoft/callback')
def auth_microsoft_callback():
    """Handle Microsoft OAuth callback"""
    microsoft = current_app.extensions['microsoft_oauth']
    token = microsoft.authorize_access_token()
    user_info = token.get('userinfo')

    if not user_info:
        user_info = microsoft.get('https://graph.microsoft.com/oidc/userinfo').json()

    email = user_info.get('email', '').lower()

    if email not in Config.ALLOWED_EMAILS:
        return render_template('login.html',
            error=f'Access denied. The email {email} is not authorized to use this application.')

    session['user_email'] = email
    session['user_name'] = user_info.get('name', email)
    session['user_picture'] = user_info.get('picture', '')
    session.permanent = True

    return redirect('/')


@auth_bp.route('/logout')
def logout():
    """Clear session and redirect to login"""
    session.clear()
    return redirect('/login')


@auth_bp.route('/api/auth/status')
def auth_status():
    """Return current auth status"""
    if session.get('user_email'):
        return jsonify({
            'authenticated': True,
            'email': session['user_email'],
            'name': session.get('user_name', ''),
            'picture': session.get('user_picture', '')
        })
    return jsonify({'authenticated': False}), 401
