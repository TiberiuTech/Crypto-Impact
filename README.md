# Crypto-Impact Platform

A full-stack cryptocurrency tracker and market analysis platform. This application provides users with real-time market data, interactive financial charts, and Web3 wallet connectivity, demonstrating proficiency in asynchronous data handling, API integration, and modern web development.

## 🚀 Key Features

* **Real-Time Data Tracking:** Utilizes WebSocket communication to stream live price updates for over 60 cryptocurrencies simultaneously without refreshing the page.
* **Web3 / Blockchain Integration:** Features MetaMask wallet connectivity, allowing users to link their crypto wallets and interact with a simulated demo wallet environment.
* **Interactive Visualization:** Dynamic, responsive charts for in-depth market data visualization and trend tracking.
* **Live News Aggregator:** Integrates an RSS-based feed to fetch and display the latest cryptocurrency news and market updates.
* **Secure User Authentication:** Secure login and account management powered by Firebase Authentication.
* **Responsive UI/UX:** Fully optimized interface that provides a seamless experience across both desktop and mobile devices.

## 💻 Tech Stack

* **Frontend:** JavaScript (ES6+), HTML5, CSS3, WebSockets
* **Backend:** Node.js, Express.js
* **Database & Auth:** Firebase
* **Web3:** MetaMask Integration

## 🛠️ Getting Started (Local Setup)

To run this project locally on your machine, follow these steps:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/TiberiuTech/licenta.git
   ```

2. **Navigate to the project directory:**
   ```bash
   cd licenta
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Configure Environment Variables:**
   * Create a `.env` file in the root directory.
   * Add your Firebase configuration keys and any external API keys used for crypto data.

5. **Start the server:**
   ```bash
   npm start
   ```

6. **Open in Browser:**
   Navigate to `http://localhost:3000` (or the port specified in your server configuration).

## 💡 Purpose

This project was developed as part of my Bachelor's Degree in Applied Computer Science (Transilvania University of Brașov), showcasing the ability to build scalable, full-stack applications with real-time data requirements.
