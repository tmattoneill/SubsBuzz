#!/usr/bin/env python3
"""
Gmail OAuth Test Script

Tests Gmail OAuth configuration and basic connectivity.
Run this after configuring GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.
"""

import os
import sys
from pathlib import Path

# Add the email worker directory to Python path
sys.path.append(str(Path(__file__).parent))

def test_oauth_configuration():
    """Test if OAuth credentials are configured"""
    print("🔧 Testing Gmail OAuth Configuration...")
    
    required_env_vars = [
        'GOOGLE_CLIENT_ID',
        'GOOGLE_CLIENT_SECRET'
    ]
    
    missing_vars = []
    for var in required_env_vars:
        if not os.getenv(var):
            missing_vars.append(var)
    
    if missing_vars:
        print(f"❌ Missing required environment variables: {', '.join(missing_vars)}")
        print("📋 Please configure these in .env.dev file:")
        for var in missing_vars:
            print(f"   {var}=your-{var.lower().replace('_', '-')}")
        return False
    
    print("✅ OAuth environment variables configured")
    return True

def test_gmail_client_import():
    """Test if GmailClient can be imported and initialized"""
    print("📧 Testing Gmail Client Import...")
    
    try:
        from gmail_client import GmailClient
        client = GmailClient()
        print("✅ Gmail client imported and initialized successfully")
        return True
    except Exception as e:
        print(f"❌ Gmail client initialization failed: {e}")
        return False

def test_oauth_credentials():
    """Test OAuth credential validation (without making API calls)"""
    print("🔑 Testing OAuth Credentials...")
    
    try:
        from gmail_client import GmailClient
        client = GmailClient()
        
        # Check if credentials look valid
        if not client.client_id or not client.client_secret:
            print("❌ OAuth credentials appear to be empty")
            return False
        
        if not client.client_id.endswith('.apps.googleusercontent.com'):
            print("⚠️  Client ID format may be incorrect (should end with .apps.googleusercontent.com)")
            return False
        
        print("✅ OAuth credentials format appears valid")
        return True
        
    except Exception as e:
        print(f"❌ OAuth credential validation failed: {e}")
        return False

def test_openai_configuration():
    """Test OpenAI API key configuration"""
    print("🤖 Testing OpenAI Configuration...")
    
    openai_key = os.getenv('OPENAI_API_KEY')
    if not openai_key:
        print("⚠️  OPENAI_API_KEY not configured (optional but recommended)")
        return True
    
    if not openai_key.startswith('sk-'):
        print("⚠️  OpenAI API key format may be incorrect (should start with 'sk-')")
        return False
    
    print("✅ OpenAI API key configured")
    return True

def main():
    """Run all OAuth tests"""
    print("🧪 Gmail OAuth Configuration Test")
    print("=" * 50)
    
    tests = [
        test_oauth_configuration,
        test_gmail_client_import, 
        test_oauth_credentials,
        test_openai_configuration
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        try:
            if test():
                passed += 1
            print()  # Add spacing between tests
        except Exception as e:
            print(f"❌ Test failed with unexpected error: {e}")
            print()
    
    print("=" * 50)
    print(f"📊 Test Results: {passed}/{total} passed ({(passed/total)*100:.1f}%)")
    
    if passed == total:
        print("🎉 Gmail OAuth configuration is ready!")
        print("📋 Next steps:")
        print("   1. Run: node tests/test-gmail-integration.js")
        print("   2. Should achieve 100% success rate")
        print("   3. Test with real Gmail account")
    else:
        print("⚠️  Configuration needs attention")
        print("📋 Please fix the issues above and run this test again")
    
    return passed == total

if __name__ == '__main__':
    # Load environment variables
    from dotenv import load_dotenv
    load_dotenv('../.env.dev')  # Load from project root
    
    success = main()
    sys.exit(0 if success else 1)