const axios = require('axios');

async function testConversation() {
    console.log("--- Starting Conversation Simulation ---");

    // Step 1: User says "Workshop"
    console.log("\nUser: Workshop for AI students");
    let res = await axios.post('http://localhost:3000/api/ai/analyze-event', {
        eventName: "Workshop for AI students",
        eventDescription: "Workshop"
    });
    console.log("AI:", res.data.data.nextQuestion);

    // Step 2: User says "Yes, we need software"
    console.log("\nUser: Yes, we need software");
    res = await axios.post('http://localhost:3000/api/ai/analyze-event', {
        eventName: "Workshop for AI students",
        eventDescription: "Yes, we need software"
    });
    console.log("AI:", res.data.data.nextQuestion);

    // Step 3: User says "No, not installed"
    console.log("\nUser: No, not installed");
    res = await axios.post('http://localhost:3000/api/ai/analyze-event', {
        eventName: "Workshop for AI students",
        eventDescription: "No, not installed"
    });
    console.log("AI:", res.data.data.nextQuestion);

    // Step 4: User says "It's a paid license"
    console.log("\nUser: It's a paid license");
    res = await axios.post('http://localhost:3000/api/ai/analyze-event', {
        eventName: "Workshop for AI students",
        eventDescription: "It's a paid license"
    });
    console.log("AI:", res.data.data.nextQuestion);
    console.log("Detected Checklist:", res.data.data.checklist);
}

testConversation().catch(err => console.error(err.message));
