// tools/apiTool.ts

import axios, { Method } from 'axios'

/**
 * API Tool
 *
 * Provides functionality for agents to make API calls when necessary.
 */
export class ApiTool {
  constructor() {
    // Initialize with any necessary configuration
  }

  /**
   * Makes an API call based on provided parameters.
   *
   * @param {string} baseUrl - The base URL for the API.
   * @param {string} endpoint - The API endpoint path.
   * @param {string} method - The HTTP method (GET, POST, etc.).
   * @param {Object} [headers={}] - Additional headers.
   * @param {Object} [params={}] - Query parameters for GET requests.
   * @param {Object} [data={}] - Payload for POST/PUT requests.
   * @returns {Promise<Object>} - The response data from the API call.
   */
  async callApi(baseUrl: string, endpoint: string, method: Method, headers = {}, params = {}, data = {}) {
    try {
      const response = await axios.request({
        method,
        url: `${baseUrl}${endpoint}`,
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        params: method.toUpperCase() === "GET" ? params : undefined,
        data: method.toUpperCase() !== "GET" ? JSON.stringify(data) : undefined,
        maxBodyLength: Infinity, 
      });
      
      

      return response.data;
    } catch (error: any) {
      console.error(`Error calling API at ${baseUrl}${endpoint}:`, error.message);
      throw error;
    }
  }
}
