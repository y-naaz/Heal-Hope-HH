#!/usr/bin/env python3
"""
Test script to verify Gemini API integration
Run this script to test if your Gemini API key is working correctly.
"""

import os
import sys
import django
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).resolve().parent
sys.path.append(str(backend_dir))

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mental_health_backend.settings')
django.setup()

def test_gemini_integration():
    """Test Gemini API integration"""
    print("🔧 Testing Gemini API Integration...")
    print("-" * 50)
    
    try:
        from django.conf import settings
        
        # Check if Gemini API key is configured
        gemini_key = getattr(settings, 'GEMINI_API_KEY', '')
        if not gemini_key or gemini_key == 'your-gemini-api-key-here':
            print("❌ Gemini API key not configured!")
            print("Please update your .env file with:")
            print("GEMINI_API_KEY=your-actual-gemini-api-key")
            return False
        
        print(f"✅ Gemini API key configured (ending with: ...{gemini_key[-4:]})")
        
        # Test Google Generative AI import
        try:
            import google.generativeai as genai
            print("✅ Google Generative AI package imported successfully")
        except ImportError as e:
            print(f"❌ Failed to import google.generativeai: {e}")
            return False
        
        # Test Gemini client initialization
        try:
            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel('gemini-1.5-flash')
            print("✅ Gemini client initialized successfully")
        except Exception as e:
            print(f"❌ Failed to initialize Gemini client: {e}")
            return False
        
        # Test AI support module integration
        try:
            from chat.ai_support import gemini_model, GEMINI_AVAILABLE
            if not GEMINI_AVAILABLE:
                print("❌ Gemini not available in AI support module")
                return False
            if gemini_model is None:
                print("❌ Gemini model not initialized in AI support module")
                return False
            print("✅ AI support module Gemini integration working")
        except Exception as e:
            print(f"❌ Failed to import AI support module: {e}")
            return False
        
        # Test a simple API call
        try:
            test_message = "Hello, this is a test message. Please respond briefly."
            response = model.generate_content(test_message)
            if response and response.text:
                print("✅ Gemini API call successful!")
                print(f"📝 Test response: {response.text[:100]}...")
            else:
                print("❌ Gemini API call failed - no response")
                return False
        except Exception as e:
            print(f"❌ Gemini API call failed: {e}")
            return False
        
        # Test enhanced AI response function
        try:
            from chat.ai_support import generate_gemini_response
            test_response = generate_gemini_response(
                message="I'm feeling a bit anxious today.",
                crisis_detected=False
            )
            if test_response and len(test_response.strip()) > 10:
                print("✅ Enhanced AI response generation working!")
                print(f"📝 Enhanced response preview: {test_response[:100]}...")
            else:
                print("❌ Enhanced AI response generation failed")
                return False
        except Exception as e:
            print(f"❌ Enhanced AI response test failed: {e}")
            return False
        
        print("\n🎉 All Gemini integration tests passed!")
        print("Your mental health chatbot is ready to use Gemini AI!")
        return True
        
    except Exception as e:
        print(f"❌ Unexpected error during testing: {e}")
        return False

def main():
    """Main function"""
    print("🧠 Mental Health Chatbot - Gemini Integration Test")
    print("=" * 60)
    
    success = test_gemini_integration()
    
    print("\n" + "=" * 60)
    if success:
        print("✅ SUCCESS: Gemini integration is working correctly!")
        print("\nNext steps:")
        print("1. Make sure your Django server is running")
        print("2. Test the chatbot in the dashboard")
        print("3. You should now see enhanced AI responses!")
    else:
        print("❌ FAILED: Please fix the issues above and try again.")
        print("\nTroubleshooting:")
        print("1. Make sure you have a valid Gemini API key")
        print("2. Update GEMINI_API_KEY in your .env file")
        print("3. Restart your Django server after updating the API key")

if __name__ == "__main__":
    main()
