const axios = require('axios');
require('dotenv').config({ path: '../.env' });

async function testAIIntegration() {
    const baseUrl = 'http://localhost:5000/api/ai';
    console.log('Testing AI Integration...');

    try {
        // Note: This might fail if the endpoint is protected by auth, 
        // but we can at least see if we get a 401/403 (route exists) vs 404 (route missing)
        const response = await axios.post(`${baseUrl}/analyze-event`, {
            eventName: 'Test Workshop',
            eventDescription: 'A test event with food and sound system'
        });
        console.log('Response:', response.data);
    } catch (error) {
        if (error.response) {
            console.log(`Status: ${error.response.status}`);
            console.log('Data:', error.response.data);
            if (error.response.status === 401) {
                console.log('✅ Route found! (Received expected 401 Unauthorized)');
            } else if (error.response.status === 404) {
                console.log('❌ Route NOT found (404)');
            } else {
                console.log('Error:', error.response.data);
            }
        } else {
            console.error('Error:', error.message);
        }
    }
}

testAIIntegration();
