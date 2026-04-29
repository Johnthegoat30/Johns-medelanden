// app.js

// Function to send a message
function sendMessage(message) {
    console.log(`Sending message: ${message}`);
    // Here you would implement the actual sending logic, e.g., an API call
}

// Function to receive a message
function receiveMessage() {
    // Here you would implement the actual receiving logic
    const message = "Hello, this is a received message!";
    console.log(`Received message: ${message}`);
    return message;
}

// Example usage
sendMessage("Hi there!");
receiveMessage();
