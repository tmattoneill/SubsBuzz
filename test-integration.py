#!/usr/bin/env python3
"""
Integration test for SubsBuzz microservices
"""

import httpx
import asyncio
import sys
import json

async def test_service_communication():
    """Test communication between services"""
    
    print("🧪 Testing SubsBuzz Microservices Integration")
    print("=" * 50)
    
    async with httpx.AsyncClient() as client:
        # Test Data Server health
        print("1. Testing Data Server...")
        try:
            response = await client.get("http://localhost:3001/health")
            if response.status_code == 200:
                data = response.json()
                print(f"   ✅ Data Server: {data['status']} (v{data['version']})")
            else:
                print(f"   ❌ Data Server: HTTP {response.status_code}")
                return False
        except Exception as e:
            print(f"   ❌ Data Server: {e}")
            return False
        
        # Test API Gateway health
        print("2. Testing API Gateway...")
        try:
            response = await client.get("http://localhost:8000/health")
            if response.status_code == 200:
                data = response.json()
                print(f"   ✅ API Gateway: {data['status']} (v{data['version']})")
            else:
                print(f"   ❌ API Gateway: HTTP {response.status_code}")
                return False
        except Exception as e:
            print(f"   ❌ API Gateway: {e}")
            return False
        
        # Test basic routing
        print("3. Testing service endpoints...")
        try:
            response = await client.get("http://localhost:3001/")
            if response.status_code == 200:
                print(f"   ✅ Data Server root endpoint accessible")
            else:
                print(f"   ⚠️  Data Server root: HTTP {response.status_code}")
                
            response = await client.get("http://localhost:8000/")
            if response.status_code == 200:
                print(f"   ✅ API Gateway root endpoint accessible")
            else:
                print(f"   ⚠️  API Gateway root: HTTP {response.status_code}")
        except Exception as e:
            print(f"   ❌ Endpoint test: {e}")
            return False
        
        print("\n🎉 Basic integration test PASSED!")
        print("\nNext steps:")
        print("- Test authentication flow")
        print("- Test database operations") 
        print("- Test email processing")
        
        return True

if __name__ == "__main__":
    success = asyncio.run(test_service_communication())
    sys.exit(0 if success else 1)