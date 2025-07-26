/**
 * Google Apps Script Deployment Testing Utilities
 * 
 * Use these functions to test and diagnose deployment issues
 */

interface TestResult {
  test: string;
  success: boolean;
  data?: any;
  error?: string;
  timestamp: string;
}

interface DeploymentTestResults {
  overall: boolean;
  tests: TestResult[];
  summary: {
    passed: number;
    failed: number;
    total: number;
  };
}

export class DeploymentTester {
  private readonly APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzScfuEZaIy-kaXeSec93vzw7DbaKfJJHzYEckavbRo37DhtdTYFQ9lP1c6CqHy3EKn/exec';
  private readonly DEV_URL = 'https://script.google.com/macros/s/AKfycbzScfuEZaIy-kaXeSec93vzw7DbaKfJJHzYEckavbRo37DhtdTYFQ9lP1c6CqHy3EKn/dev';

  /**
   * Test basic GET request to verify deployment is responding
   */
  async testBasicConnection(): Promise<TestResult> {
    const testName = 'Basic Connection Test';
    try {
      const response = await fetch(`${this.APPS_SCRIPT_URL}?test=basic&timestamp=${Date.now()}`);
      const data = await response.json();
      
      return {
        test: testName,
        success: response.ok && data.success,
        data,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        test: testName,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Test POST request with function call
   */
  async testFunctionCall(): Promise<TestResult> {
    const testName = 'Function Call Test';
    try {
      const formData = new FormData();
      formData.append('function', 'testFunction');
      formData.append('parameters', JSON.stringify([]));

      const response = await fetch(this.APPS_SCRIPT_URL, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();

      return {
        test: testName,
        success: response.ok && data.success,
        data,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        test: testName,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Test health check endpoint
   */
  async testHealthCheck(): Promise<TestResult> {
    const testName = 'Health Check Test';
    try {
      const formData = new FormData();
      formData.append('function', 'getHealthCheck');
      formData.append('parameters', JSON.stringify([]));

      const response = await fetch(this.APPS_SCRIPT_URL, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();

      return {
        test: testName,
        success: response.ok && data.success && data.status === 'healthy',
        data,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        test: testName,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Test deployment with parameter passing
   */
  async testParameterPassing(): Promise<TestResult> {
    const testName = 'Parameter Passing Test';
    const testData = `test-${Date.now()}`;
    
    try {
      const formData = new FormData();
      formData.append('function', 'testDeployment');
      formData.append('parameters', JSON.stringify([testData]));

      const response = await fetch(this.APPS_SCRIPT_URL, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();

      const parameterMatchesExpected = data.receivedData === testData;

      return {
        test: testName,
        success: response.ok && data.success && parameterMatchesExpected,
        data: {
          ...data,
          expectedData: testData,
          parameterMatches: parameterMatchesExpected
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        test: testName,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Compare development vs production deployment
   */
  async testDevVsProduction(): Promise<TestResult> {
    const testName = 'Dev vs Production Comparison';
    try {
      // Test development endpoint
      const devResponse = await fetch(`${this.DEV_URL}?test=dev&timestamp=${Date.now()}`);
      const devData = await devResponse.json();

      // Test production endpoint
      const prodResponse = await fetch(`${this.APPS_SCRIPT_URL}?test=prod&timestamp=${Date.now()}`);
      const prodData = await prodResponse.json();

      const versionMatches = devData.version === prodData.version;
      const bothResponding = devResponse.ok && prodResponse.ok;

      return {
        test: testName,
        success: bothResponding && versionMatches,
        data: {
          dev: devData,
          production: prodData,
          versionMatches,
          devVersion: devData.version,
          prodVersion: prodData.version
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        test: testName,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Run all deployment tests
   */
  async runAllTests(): Promise<DeploymentTestResults> {
    console.log('🔍 Starting Google Apps Script deployment tests...');
    
    const tests = await Promise.all([
      this.testBasicConnection(),
      this.testFunctionCall(),
      this.testHealthCheck(),
      this.testParameterPassing(),
      this.testDevVsProduction()
    ]);

    const passed = tests.filter(test => test.success).length;
    const failed = tests.filter(test => !test.success).length;
    const overall = failed === 0;

    const results: DeploymentTestResults = {
      overall,
      tests,
      summary: {
        passed,
        failed,
        total: tests.length
      }
    };

    console.log('📊 Test Results Summary:', results.summary);
    console.log('✅ Passed tests:', tests.filter(t => t.success).map(t => t.test));
    console.log('❌ Failed tests:', tests.filter(t => !t.success).map(t => t.test));

    return results;
  }

  /**
   * Print detailed test results to console
   */
  printResults(results: DeploymentTestResults) {
    console.group('🔍 Google Apps Script Deployment Test Results');
    
    console.log(`Overall Status: ${results.overall ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Tests: ${results.summary.passed}/${results.summary.total} passed`);
    
    results.tests.forEach(test => {
      console.group(`${test.success ? '✅' : '❌'} ${test.test}`);
      
      if (test.success && test.data) {
        console.log('Data:', test.data);
      } else if (!test.success && test.error) {
        console.error('Error:', test.error);
      }
      
      console.log('Timestamp:', test.timestamp);
      console.groupEnd();
    });
    
    console.groupEnd();
  }

  /**
   * Quick test - just check if deployment is responding with correct version
   */
  async quickTest(): Promise<void> {
    console.log('🚀 Running quick deployment test...');
    
    try {
      const response = await fetch(`${this.APPS_SCRIPT_URL}?quickTest=${Date.now()}`);
      const data = await response.json();
      
      console.log('✅ Deployment responding!');
      console.log('Version:', data.version);
      console.log('Last Updated:', data.lastUpdated);
      console.log('Server Time:', data.serverTime);
      console.log('Full Response:', data);
    } catch (error) {
      console.error('❌ Deployment test failed:', error);
    }
  }
}

// Export singleton instance for easy use
export const deploymentTester = new DeploymentTester();

// Global functions for browser console testing
if (typeof window !== 'undefined') {
  (window as any).testDeployment = deploymentTester.runAllTests.bind(deploymentTester);
  (window as any).quickTestDeployment = deploymentTester.quickTest.bind(deploymentTester);
}